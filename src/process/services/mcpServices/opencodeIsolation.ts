/**
 * @license
 * Copyright 2026 CriterioIA
 * SPDX-License-Identifier: Apache-2.0
 */

import { app } from 'electron';
import { mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Aislamiento del OpenCode embebido respecto del equipo donde se instala
 * CriterioIA.
 *
 * PROBLEMA: OpenCode descubre skills, comandos, MCPs, agentes e instrucciones
 * (AGENTS.md) desde el HOME del usuario:
 *   - ~/.config/opencode/skills, ~/.agents/skills, ~/.claude/skills
 *   - ~/.config/opencode/commands, ~/.config/opencode/opencode.json (MCPs),
 *     ~/.config/opencode/AGENTS.md
 * Sin aislamiento, el agente judicial ve y puede usar las herramientas
 * personales del administrador (ej. skills "caveman", "design-system", MCP
 * "codebase-memory"), que ademas se vuelcan como ruido "Available Commands"
 * en el chat.
 *
 * SOLUCION (una sola direccion): el proceso hijo de OpenCode se lanza con un
 * HOME falso apuntando a una carpeta propia de CriterioIA
 * (`<userData>/opencode-home`). OpenCode entonces solo ve un home vacio
 * controlado por la app.
 *
 * RESTRICCION EXPLICITA: esto NO toca ni borra nada del equipo del cliente.
 * Sus skills, su opencode.json y sus MCPs personales quedan intactos; solo
 * se usan variables de entorno del proceso hijo, que mueren con el proceso.
 */

/** Subcarpeta de userData que actua como HOME falso del OpenCode embebido. */
export function getOpencodeSandboxHome(): string {
  const sandbox = join(app.getPath('userData'), 'opencode-home');
  mkdirSync(sandbox, { recursive: true });
  return sandbox;
}

/**
 * Variables de entorno que redirigen la resolucion de `~` del hijo al sandbox.
 * - HOME + USERPROFILE: lo que Node/Bun usan en os.homedir() (win32 y posix).
 * - XDG_*: lo que OpenCode respeta para config/data/cache.
 * NO se tocan APPDATA/LOCALAPPDATA/PROGRAMDATA: el config global de OpenCode
 * es relativo al home (`~/.config`), no a APPDATA, y tocarlas podria romper
 * otras resoluciones legitimas del hijo.
 */
export function getOpencodeSandboxEnv(): Record<string, string> {
  const sandbox = getOpencodeSandboxHome();
  return {
    HOME: sandbox,
    USERPROFILE: sandbox,
    XDG_CONFIG_HOME: join(sandbox, '.config'),
    XDG_DATA_HOME: join(sandbox, '.local', 'share'),
    XDG_CACHE_HOME: join(sandbox, '.cache'),
  };
}

/**
 * Variables que, si el usuario las tiene definidas en su sesion, harian que
 * OpenCode cargue configuracion del equipo real aunque el HOME este aislado:
 * - OPENCODE_CONFIG: ruta a un opencode.json del usuario (contiene sus MCPs).
 * - OPENCODE_CONFIG_DIR: directorio .opencode del usuario (skills/comandos).
 * Se eliminan del entorno del hijo (no se redefinen: una ruta vacia o
 * inexistente haria fallar a OpenCode). CriterioIA pasa todo lo suyo via
 * OPENCODE_CONFIG_CONTENT, que tiene mayor precedencia de todos modos.
 */
export const OPENCODE_SANITIZED_ENV_VARS: readonly string[] = ['OPENCODE_CONFIG', 'OPENCODE_CONFIG_DIR'];
