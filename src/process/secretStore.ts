/**
 * @license
 * Copyright 2026 CriterioIA
 * SPDX-License-Identifier: Apache-2.0
 */

import { safeStorage } from 'electron';

/**
 * Cifrado de secretos en reposo (API keys) usando el keychain del sistema operativo vía
 * Electron safeStorage: DPAPI en Windows, Keychain en macOS, libsecret en Linux. La clave
 * de cifrado la gestiona el SO y está atada a la cuenta de usuario, así que el valor en
 * disco no es legible copiando el archivo de config.
 *
 * Formato en disco: "enc:v1:<base64>". Los valores SIN ese prefijo se tratan como texto
 * plano (compatibilidad con keys guardadas antes de introducir el cifrado, y fallback si
 * safeStorage no está disponible en la plataforma).
 */
const PREFIX = 'enc:v1:';

export function isSecretEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable();
  } catch {
    return false;
  }
}

/** Cifra un secreto para guardarlo. Si safeStorage no está disponible, devuelve el texto tal cual. */
export function encryptSecret(plaintext: string): string {
  if (!plaintext || plaintext.startsWith(PREFIX)) return plaintext; // vacío o ya cifrado
  try {
    if (!safeStorage.isEncryptionAvailable()) return plaintext;
    const buf = safeStorage.encryptString(plaintext);
    return PREFIX + buf.toString('base64');
  } catch {
    return plaintext; // nunca bloquear el guardado por un fallo de cifrado
  }
}

/**
 * Descifra un secreto guardado. Si no tiene el prefijo, se asume texto plano y se devuelve
 * tal cual (keys previas al cifrado). Si el descifrado falla (p. ej. la config se movió a
 * otra cuenta/equipo), devuelve "" para que la UI pida reingresar la key.
 */
export function decryptSecret(stored: string | undefined | null): string {
  if (!stored) return '';
  if (!stored.startsWith(PREFIX)) return stored; // texto plano heredado
  try {
    const b64 = stored.slice(PREFIX.length);
    return safeStorage.decryptString(Buffer.from(b64, 'base64'));
  } catch {
    return '';
  }
}
