/**
 * @license
 * Copyright 2026 CriterioIA
 * SPDX-License-Identifier: Apache-2.0
 */

import { app } from 'electron';
import path from 'path';

/**
 * Descriptor compartido del servidor MCP judicial (backend/mcp_server.py / mcp_server.exe).
 *
 * Centraliza la resolución de rutas dev/empaquetado para que cualquier consumidor
 * (GeminiAgentManager, el seed de mcp.config en initStorage, futuros agentes MCP
 * por-backend) apunte siempre al mismo ejecutable/script sin duplicar lógica.
 */
export interface JudicialMcpServerDescriptor {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  description: string;
}

/**
 * Raíz del proyecto CaminoIA (contiene backend/, data_input/, etc.).
 *
 * - Empaquetado: process.resourcesPath (recursos incluidos en el instalador).
 * - Dev: CRITERIOIA_BACKEND_ROOT si está seteada, si no, el padre de app.getAppPath()
 *   (app.getAppPath() es el directorio de temp_aionui/ en dev, y CaminoIA/ es su padre).
 *
 * Nunca hardcodear la ruta absoluta de una máquina de desarrollo específica.
 */
export function getJudicialBackendRoot(): string {
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  return process.env.CRITERIOIA_BACKEND_ROOT || path.resolve(app.getAppPath(), '..');
}

/**
 * Arma el descriptor {command, args, env} del servidor MCP judicial.
 * @param dataDir Directorio data_input a usar (por defecto, el central bajo el backend root).
 */
export function getJudicialMcpServerDescriptor(dataDir?: string): JudicialMcpServerDescriptor {
  const backendRoot = getJudicialBackendRoot();

  let command: string;
  let args: string[];

  if (app.isPackaged) {
    command = path.join(backendRoot, 'mcp_server', 'mcp_server.exe');
    args = [];
  } else {
    const backendScript = path.join(backendRoot, 'backend', 'mcp_server.py');
    command = path.join(backendRoot, 'venv', 'Scripts', 'python');
    args = [backendScript];
  }

  const resolvedDataDir = dataDir || path.join(backendRoot, 'data_input');

  return {
    name: 'judicial-solver',
    command,
    args,
    env: {
      CRITERIOIA_DATA_DIR: resolvedDataDir,
      PYTHONUTF8: '1',
    },
    description: 'Judicial Scheduler Solver (Juez, Turno, Ausencias)',
  };
}
