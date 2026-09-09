/**
 * @license
 * Copyright 2026 CriterioIA
 * SPDX-License-Identifier: Apache-2.0
 */

import { app } from 'electron';
import path from 'path';
import { getJudicialBackendRoot, getJudicialDataDir } from './judicialMcpDescriptor';

/**
 * Descriptor del servidor MCP de herramientas de desarrollo (backend/dev_tools_mcp_server.py).
 *
 * Calcado de judicialMcpDescriptor.ts, con dos diferencias deliberadas:
 *  1. Apunta a un ejecutable/script DISTINTO (dev_tools_mcp_server) con la superficie
 *     peligrosa (fs/shell/SQL). El servidor judicial nunca importa esto.
 *  2. NUNCA se siembra en el registro global mcp.config. Se adjunta explicitamente solo
 *     a conversaciones dev-agent (ver GeminiAgentManager/AcpAgent), para que el chat
 *     judicial jamas tenga acceso a estas herramientas.
 *
 * En la app EMPAQUETADA, dev_tools_mcp_server.exe se genera como un segundo target
 * cx_Freeze en setup_cx.py, dentro de la misma carpeta dist/mcp_server/ (comparte el
 * interprete y las libs con mcp_server.exe, por lo que agrega poco tamano).
 */
export interface DevToolsMcpServerDescriptor {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  description: string;
}

export function getDevToolsMcpServerDescriptor(): DevToolsMcpServerDescriptor {
  const backendRoot = getJudicialBackendRoot();

  let command: string;
  let args: string[];

  if (app.isPackaged) {
    command = path.join(backendRoot, 'mcp_server', 'dev_tools_mcp_server.exe');
    args = [];
  } else {
    const script = path.join(backendRoot, 'backend', 'dev_tools_mcp_server.py');
    command = path.join(backendRoot, 'venv', 'Scripts', 'python');
    args = [script];
  }

  // aionui.db vive en el userData de Electron (historial de chat).
  const appDbPath = path.join(app.getPath('userData'), 'aionui', 'aionui.db');

  return {
    name: 'dev-tools',
    command,
    args,
    env: {
      CRITERIOIA_REPO_ROOT: backendRoot,
      CRITERIOIA_DATA_DIR: getJudicialDataDir(),
      CRITERIOIA_APPDB_PATH: appDbPath,
      PYTHONUTF8: '1',
    },
    description: 'CriterioIA Dev Tools (filesystem, shell, raw SQL, git/db checkpoints)',
  };
}
