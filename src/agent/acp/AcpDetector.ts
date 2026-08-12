/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import { app } from 'electron';
import type { AcpBackendAll } from '@/types/acpTypes';
import { POTENTIAL_ACP_CLIS } from '@/types/acpTypes';
import { ProcessConfig } from '@/process/initStorage';

/**
 * CriterioIA: OpenCode viene embebido (dependencia `opencode-ai`) para que el
 * administrador no tenga que instalarlo aparte. Se comprueban varias rutas posibles:
 * dev (node_modules/ directo bajo la raíz de la app, mismo patrón que
 * judicialMcpDescriptor.ts's getJudicialBackendRoot()) y empaquetado — este proyecto
 * tiene dos pipelines de empaquetado en paralelo (Electron Forge con `extraResource`,
 * y electron-builder con `asarUnpack`), cada uno con una convención de carpetas
 * distinta para los recursos desempaquetados.
 */
const getBundledOpencodePath = (): string | null => {
  const binName = process.platform === 'win32' ? 'opencode.exe' : 'opencode';
  const candidates: string[] = [];

  if (app.isPackaged) {
    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, 'node_modules', 'opencode-ai', 'bin', binName), path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'opencode-ai', 'bin', binName));
    }
  } else {
    candidates.push(path.join(app.getAppPath(), 'node_modules', 'opencode-ai', 'bin', binName));
  }

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
};

interface DetectedAgent {
  backend: AcpBackendAll;
  name: string;
  cliPath?: string;
  acpArgs?: string[];
  customAgentId?: string; // UUID for custom agents
}

/**
 * 全局ACP检测器 - 启动时检测一次，全局共享结果
 */
class AcpDetector {
  private detectedAgents: DetectedAgent[] = [];
  private isDetected = false;

  /**
   * 将自定义代理添加到检测列表（追加到末尾）
   * Add custom agents to detected list if configured and enabled (appends to end).
   */
  private async addCustomAgentsToList(detected: DetectedAgent[]): Promise<void> {
    try {
      const customAgents = await ProcessConfig.get('acp.customAgents');
      if (!customAgents || !Array.isArray(customAgents) || customAgents.length === 0) return;

      // 过滤出已启用且有有效 CLI 路径的代理 / Filter enabled agents with valid CLI path
      const enabledAgents = customAgents.filter((agent) => agent.enabled && agent.defaultCliPath);
      if (enabledAgents.length === 0) return;

      // 将所有自定义代理追加到列表末尾 / Append all custom agents to the end
      const customDetectedAgents: DetectedAgent[] = enabledAgents.map((agent) => ({
        backend: 'custom',
        name: agent.name || 'Custom Agent',
        cliPath: agent.defaultCliPath,
        acpArgs: agent.acpArgs,
        customAgentId: agent.id, // 存储 UUID 用于标识 / Store the UUID for identification
      }));

      detected.push(...customDetectedAgents);
    } catch (error) {
      // 配置读取失败时区分预期错误和非预期错误
      // Distinguish expected vs unexpected errors when reading config
      if (error instanceof Error && (error.message.includes('ENOENT') || error.message.includes('not found'))) {
        // 未配置自定义代理 - 这是正常情况 / No custom agents configured - this is normal
        return;
      }
      console.warn('[AcpDetector] Unexpected error loading custom agents:', error);
    }
  }

  /**
   * 启动时执行检测 - 使用 POTENTIAL_ACP_CLIS 列表检测已安装的 CLI
   */
  async initialize(): Promise<void> {
    if (this.isDetected) return;

    console.log('[ACP] Starting agent detection...');
    const startTime = Date.now();

    const isWindows = process.platform === 'win32';
    const whichCommand = isWindows ? 'where' : 'which';

    const detected: DetectedAgent[] = [];

    // 并行检测所有潜在的 ACP CLI
    const detectionPromises = POTENTIAL_ACP_CLIS.map((cli) => {
      return Promise.resolve().then(() => {
        // OpenCode viene embebido: si el binario empaquetado existe, se usa directo
        // sin depender del PATH del sistema (el usuario no necesita instalarlo aparte).
        if (cli.backendId === 'opencode') {
          const bundledPath = getBundledOpencodePath();
          if (bundledPath) {
            return {
              backend: cli.backendId,
              name: cli.name,
              cliPath: bundledPath,
              acpArgs: cli.args,
            };
          }
        }

        try {
          execSync(`${whichCommand} ${cli.cmd}`, {
            encoding: 'utf-8',
            stdio: 'pipe',
            timeout: 1000,
          });

          return {
            backend: cli.backendId,
            name: cli.name,
            cliPath: cli.cmd,
            acpArgs: cli.args,
          };
        } catch {
          return null;
        }
      });
    });

    const results = await Promise.allSettled(detectionPromises);

    // 收集检测结果
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        detected.push(result.value);
      }
    }

    // 如果检测到ACP工具，添加内置Gemini
    if (detected.length > 0) {
      detected.unshift({
        backend: 'gemini',
        name: 'Gemini CLI',
        cliPath: undefined,
        acpArgs: undefined,
      });
    }

    // Check for custom agents configuration - insert after claude if found
    await this.addCustomAgentsToList(detected);

    this.detectedAgents = detected;
    this.isDetected = true;

    const elapsed = Date.now() - startTime;
    console.log(`[ACP] Detection completed in ${elapsed}ms, found ${detected.length} agents`);
  }

  /**
   * 获取检测结果
   */
  getDetectedAgents(): DetectedAgent[] {
    return this.detectedAgents;
  }

  /**
   * 是否有可用的ACP工具
   */
  hasAgents(): boolean {
    return this.detectedAgents.length > 0;
  }

  /**
   * Refresh custom agents detection only (called when config changes)
   */
  async refreshCustomAgents(): Promise<void> {
    // Remove existing custom agents if present
    this.detectedAgents = this.detectedAgents.filter((agent) => agent.backend !== 'custom');

    // Re-add custom agents with current config
    await this.addCustomAgentsToList(this.detectedAgents);
  }
}

// 单例实例
export const acpDetector = new AcpDetector();
