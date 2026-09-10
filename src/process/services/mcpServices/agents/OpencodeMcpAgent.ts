/**
 * @license
 * Copyright 2026 CriterioIA
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type { McpOperationResult } from '../McpProtocol';
import { AbstractMcpAgent } from '../McpProtocol';
import type { IMcpServer } from '../../../../common/storage';
import { getOpencodeSandboxHome } from '../opencodeIsolation';

/**
 * Config local de un servidor MCP tal como OpenCode lo guarda en opencode.json.
 * https://opencode.ai/docs/mcp-servers (verificado por búsqueda web, 2026):
 *   { "mcp": { "<name>": { "type": "local", "command": [...], "enabled": true, "environment": {...} } } }
 */
interface OpencodeLocalMcpEntry {
  type: 'local' | 'remote';
  command?: string[];
  url?: string;
  enabled?: boolean;
  environment?: Record<string, string>;
}

interface OpencodeConfig {
  $schema?: string;
  mcp?: Record<string, OpencodeLocalMcpEntry | { servers?: Record<string, OpencodeLocalMcpEntry> }>;
  [key: string]: unknown;
}

/**
 * OpenCode MCP代理实现
 *
 * CriterioIA: este agente opera SOBRE EL SANDBOX (`opencode-home`, ver
 * opencodeIsolation.ts), NUNCA sobre el home real del usuario. Motivos:
 *  1. Leer `~/.config/opencode/opencode.json` del equipo meteria los MCPs
 *     personales del administrador (ej. "codebase-memory") al registro interno
 *     mcp.config, y de ahi a las sesiones judiciales via session/new.
 *  2. Escribir ahi contaminaria en sentido inverso las herramientas de
 *     programacion del cliente con servidores de CriterioIA.
 * El OpenCode hijo corre con el mismo sandbox como HOME, asi que lo que se
 * instala desde Settings > MCP Management lo ve ese hijo nativamente, y el
 * opencode personal del cliente queda 100% intacto (ni se lee ni se escribe).
 *
 * Nota: si el archivo tiene comentarios JSONC, se pierden al reescribir (JSON.parse/
 * stringify no los preserva). Aceptable porque sólo esta clase toca la clave "mcp".
 */
export class OpencodeMcpAgent extends AbstractMcpAgent {
  constructor() {
    super('opencode');
  }

  getSupportedTransports(): string[] {
    return ['stdio'];
  }

  private getConfigPath(): string {
    return join(getOpencodeSandboxHome(), '.config', 'opencode', 'opencode.json');
  }

  private readConfig(): OpencodeConfig {
    const configPath = this.getConfigPath();
    if (!existsSync(configPath)) {
      return { $schema: 'https://opencode.ai/config.json', mcp: {} };
    }
    try {
      const raw = readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw) as OpencodeConfig;
      if (!parsed.mcp) {
        parsed.mcp = {};
      }
      return parsed;
    } catch (error) {
      console.warn('[OpencodeMcpAgent] Failed to parse opencode.json, treating as empty config:', error);
      return { $schema: 'https://opencode.ai/config.json', mcp: {} };
    }
  }

  private writeConfig(config: OpencodeConfig): void {
    const configPath = this.getConfigPath();
    mkdirSync(dirname(configPath), { recursive: true });
    // Nota: si opencode.json tenía comentarios JSONC, se pierden aquí (ver docstring de la clase).
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * Extrae el mapa plano <name, entry> tolerando tanto `mcp.<name>` (forma canónica
   * observada en la documentación oficial) como `mcp.servers.<name>` (forma vista en
   * algunos mirrors/versiones de la doc) para no perder entradas existentes al leer.
   */
  private flattenMcpEntries(config: OpencodeConfig): Record<string, OpencodeLocalMcpEntry> {
    const mcp = config.mcp || {};
    const flat: Record<string, OpencodeLocalMcpEntry> = {};

    // Forma anidada vista en algunos mirrors de la doc: { mcp: { servers: { name: {...} } } }
    const nestedServers = (mcp as { servers?: Record<string, OpencodeLocalMcpEntry> }).servers;
    if (nestedServers && typeof nestedServers === 'object') {
      Object.assign(flat, nestedServers);
    }

    // Forma canónica de la doc oficial: { mcp: { name: {...} } }, cada entry con su "type"
    for (const [key, value] of Object.entries(mcp)) {
      if (key === 'servers') continue;
      if (value && typeof value === 'object' && 'type' in (value as object)) {
        flat[key] = value as OpencodeLocalMcpEntry;
      }
    }

    return flat;
  }

  detectMcpServers(_cliPath?: string): Promise<IMcpServer[]> {
    const detectOperation = (): Promise<IMcpServer[]> => {
      try {
        const config = this.readConfig();
        const entries = this.flattenMcpEntries(config);
        const now = Date.now();

        const servers: IMcpServer[] = [];
        for (const [name, entry] of Object.entries(entries)) {
          if (entry.type !== 'local' || !Array.isArray(entry.command) || entry.command.length === 0) {
            continue; // sólo modelamos servidores locales/stdio
          }
          const [command, ...args] = entry.command;
          servers.push({
            id: `opencode_${name}`,
            name,
            transport: {
              type: 'stdio',
              command,
              args,
              env: entry.environment || {},
            },
            tools: [],
            enabled: entry.enabled !== false,
            status: 'disconnected', // config estática: se confirma recién al testMcpConnection/uso real
            createdAt: now,
            updatedAt: now,
            description: '',
            originalJson: JSON.stringify({ mcp: { [name]: entry } }, null, 2),
          });
        }

        console.log(`[OpencodeMcpAgent] Detection complete: found ${servers.length} server(s)`);
        return Promise.resolve(servers);
      } catch (error) {
        console.warn('[OpencodeMcpAgent] Failed to detect MCP servers:', error);
        return Promise.resolve([]);
      }
    };

    Object.defineProperty(detectOperation, 'name', { value: 'detectMcpServers' });
    return this.withLock(detectOperation);
  }

  installMcpServers(mcpServers: IMcpServer[]): Promise<McpOperationResult> {
    const installOperation = (): Promise<McpOperationResult> => {
      try {
        const config = this.readConfig();
        if (!config.mcp) {
          config.mcp = {};
        }

        for (const server of mcpServers) {
          if (server.transport.type !== 'stdio') {
            console.warn(`[OpencodeMcpAgent] Skipping ${server.name}: OpenCode local MCP entries only support stdio-equivalent (type: "local") servers`);
            continue;
          }

          const entry: OpencodeLocalMcpEntry = {
            type: 'local',
            command: [server.transport.command, ...(server.transport.args || [])],
            enabled: true,
            environment: server.transport.env || {},
          };

          // Sólo tocamos la clave de este servidor puntual; el resto del archivo queda intacto.
          (config.mcp as Record<string, OpencodeLocalMcpEntry>)[server.name] = entry;
        }

        this.writeConfig(config);
        console.log('[OpencodeMcpAgent] Installed MCP servers:', mcpServers.map((s) => s.name).join(', '));
        return Promise.resolve({ success: true });
      } catch (error) {
        console.error('[OpencodeMcpAgent] Failed to install MCP servers:', error);
        return Promise.resolve({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    };

    Object.defineProperty(installOperation, 'name', { value: 'installMcpServers' });
    return this.withLock(installOperation);
  }

  removeMcpServer(mcpServerName: string): Promise<McpOperationResult> {
    const removeOperation = (): Promise<McpOperationResult> => {
      try {
        const config = this.readConfig();
        if (config.mcp) {
          delete (config.mcp as Record<string, unknown>)[mcpServerName];
          const maybeServersContainer = config.mcp as { servers?: Record<string, unknown> };
          if (maybeServersContainer.servers) {
            delete maybeServersContainer.servers[mcpServerName];
          }
        }
        this.writeConfig(config);
        console.log(`[OpencodeMcpAgent] Removed MCP server (if present): ${mcpServerName}`);
        return Promise.resolve({ success: true });
      } catch (error) {
        console.error(`[OpencodeMcpAgent] Failed to remove MCP server ${mcpServerName}:`, error);
        return Promise.resolve({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    };

    Object.defineProperty(removeOperation, 'name', { value: 'removeMcpServer' });
    return this.withLock(removeOperation);
  }
}
