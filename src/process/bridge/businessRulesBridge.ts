/**
 * @license
 * Copyright 2026 CriterioIA
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { ipcBridge } from '../../common';
import type { IBusinessRulesSettings } from '../../common/ipcBridge';
import { getJudicialBackendRoot } from '../services/mcpServices/judicialMcpDescriptor';

/**
 * Reglas de negocio judiciales configurables desde Settings > Reglas de Negocio.
 *
 * Lee/escribe el mismo archivo `data_input/business_rules.json` que consume
 * backend/business_rules.py (fuente unica de verdad), para que un cambio hecho desde
 * la UI o desde el chat (update_business_rules_settings) se refleje en el otro lado
 * sin duplicar el almacenamiento.
 */

const DEFAULT_RULES: IBusinessRulesSettings = {
  despacho_minimo_ideal: 2,
  pfi_block_size: 5,
  min_judges_required: 9,
  juicio_min_per_judge: 1,
};

const BOUNDS: Record<keyof IBusinessRulesSettings, [number, number]> = {
  despacho_minimo_ideal: [0, 10],
  pfi_block_size: [1, 20],
  min_judges_required: [1, 50],
  juicio_min_per_judge: [0, 5],
};

function getBusinessRulesPath(): string {
  return path.join(getJudicialBackendRoot(), 'data_input', 'business_rules.json');
}

function readBusinessRules(): IBusinessRulesSettings {
  const filePath = getBusinessRulesPath();
  if (!existsSync(filePath)) {
    return { ...DEFAULT_RULES };
  }
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
    const merged = { ...DEFAULT_RULES };
    for (const key of Object.keys(DEFAULT_RULES) as Array<keyof IBusinessRulesSettings>) {
      if (typeof raw[key] === 'number') {
        merged[key] = raw[key];
      }
    }
    return merged;
  } catch (error) {
    console.warn('[businessRulesBridge] business_rules.json invalido, usando defaults:', error);
    return { ...DEFAULT_RULES };
  }
}

function writeBusinessRules(rules: IBusinessRulesSettings): void {
  const filePath = getBusinessRulesPath();
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(rules, null, 2), 'utf-8');
}

export function initBusinessRulesBridge(): void {
  ipcBridge.businessRules.get.provider(() => {
    return Promise.resolve(readBusinessRules());
  });

  ipcBridge.businessRules.update.provider((updates) => {
    try {
      const current = readBusinessRules();
      const next = { ...current };

      for (const key of Object.keys(updates) as Array<keyof IBusinessRulesSettings>) {
        const value = updates[key];
        if (value === undefined) continue;
        if (!(key in DEFAULT_RULES)) continue;
        if (!Number.isFinite(value)) {
          return Promise.resolve({ success: false, msg: `'${key}' debe ser un numero.` });
        }
        const [lo, hi] = BOUNDS[key];
        if (value < lo || value > hi) {
          return Promise.resolve({ success: false, msg: `'${key}' debe estar entre ${lo} y ${hi}.` });
        }
        next[key] = Math.round(value);
      }

      writeBusinessRules(next);
      return Promise.resolve({ success: true, data: next });
    } catch (error) {
      return Promise.resolve({ success: false, msg: error instanceof Error ? error.message : String(error) });
    }
  });
}
