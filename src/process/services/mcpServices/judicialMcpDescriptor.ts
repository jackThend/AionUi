/**
 * @license
 * Copyright 2026 CriterioIA
 * SPDX-License-Identifier: Apache-2.0
 */

import { app } from 'electron';
import path from 'path';
import fs from 'fs';

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
 * Directorio de datos REAL del administrador: jueces.xlsx, ausencias.xlsx,
 * judicial_scheduler.db, feriados_*.xlsx, business_rules.json — y la raíz de los
 * respaldos (backups/ se crea junto a esta carpeta).
 *
 * - EMPAQUETADO: `%APPDATA%/CriterioIA/data_input` (app.getPath('userData')). Ubicación
 *   ESTABLE que las actualizaciones de la app NO pisan (a diferencia de resources/, que
 *   se reemplaza en cada versión). En el primer arranque se SIEMBRA copiando la plantilla
 *   incluida en `resources/data_input` (jueces, feriados, DB vacía, reglas).
 * - DEV: `CaminoIA/data_input` (el data_input de trabajo del repo), sin sembrar.
 *
 * Centralizado para que el MCP judicial, el dev-tools, business_rules y los adjuntos usen
 * TODOS la misma carpeta. Ver decisión de persistencia (datos fuera de la carpeta de la app).
 */
let _resolvedDataDir: string | null = null;
export function getJudicialDataDir(): string {
  if (!app.isPackaged) {
    return path.join(getJudicialBackendRoot(), 'data_input');
  }
  if (_resolvedDataDir) return _resolvedDataDir;

  const stableDir = path.join(app.getPath('userData'), 'data_input');
  try {
    const isEmpty = !fs.existsSync(stableDir) || fs.readdirSync(stableDir).length === 0;
    if (isEmpty) {
      // Primer arranque: sembrar desde la plantilla empaquetada.
      fs.mkdirSync(stableDir, { recursive: true });
      const bundled = path.join(process.resourcesPath, 'data_input');
      if (fs.existsSync(bundled)) {
        for (const entry of fs.readdirSync(bundled)) {
          const srcPath = path.join(bundled, entry);
          const destPath = path.join(stableDir, entry);
          if (fs.statSync(srcPath).isFile() && !fs.existsSync(destPath)) {
            fs.copyFileSync(srcPath, destPath);
          }
        }
        console.log(`[JudicialDataDir] data_input sembrado en ${stableDir} desde ${bundled}`);
      }
    }
  } catch (e) {
    console.error('[JudicialDataDir] Error al sembrar el data_input estable:', e);
  }
  _resolvedDataDir = stableDir;
  return stableDir;
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

  const resolvedDataDir = dataDir || getJudicialDataDir();

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
