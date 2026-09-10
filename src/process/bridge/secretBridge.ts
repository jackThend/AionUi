/**
 * @license
 * Copyright 2026 CriterioIA
 * SPDX-License-Identifier: Apache-2.0
 */

import { ipcBridge } from '../../common';
import { encryptSecret, decryptSecret, isSecretEncryptionAvailable } from '../secretStore';

/**
 * Expone el cifrado de secretos (safeStorage) al renderer. La API key de OpenCode se
 * cifra al guardarla en Settings y se descifra en memoria al cargarla / usarla.
 */
export function initSecretBridge(): void {
  ipcBridge.secret.encrypt.provider(({ plaintext }) => Promise.resolve(encryptSecret(plaintext)));
  ipcBridge.secret.decrypt.provider(({ ciphertext }) => Promise.resolve(decryptSecret(ciphertext)));
  ipcBridge.secret.isAvailable.provider(() => Promise.resolve(isSecretEncryptionAvailable()));
}
