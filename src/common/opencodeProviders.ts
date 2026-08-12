/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CriterioIA: lista curada de proveedores para el OpenCode embebido. `envVar` es
 * la variable de entorno que OpenCode ya reconoce nativamente para cada proveedor
 * (confirmado en vivo: con la key seteada, `opencode models` lista los modelos de
 * ese proveedor sin ningún login/config adicional) — no requiere tocar el archivo
 * de auth propio de OpenCode.
 */
export interface OpencodeProviderOption {
  id: string;
  name: string;
  envVar: string;
  defaultModel: string;
}

export const OPENCODE_PROVIDERS: OpencodeProviderOption[] = [
  { id: 'anthropic', name: 'Anthropic', envVar: 'ANTHROPIC_API_KEY', defaultModel: 'anthropic/claude-sonnet-4-5' },
  { id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY', defaultModel: 'openai/gpt-5.1' },
  { id: 'deepseek', name: 'DeepSeek', envVar: 'DEEPSEEK_API_KEY', defaultModel: 'deepseek/deepseek-chat' },
  { id: 'groq', name: 'Groq', envVar: 'GROQ_API_KEY', defaultModel: 'groq/llama-3.3-70b-versatile' },
  { id: 'xai', name: 'xAI', envVar: 'XAI_API_KEY', defaultModel: 'xai/grok-4' },
  { id: 'openrouter', name: 'OpenRouter', envVar: 'OPENROUTER_API_KEY', defaultModel: 'openrouter/anthropic/claude-sonnet-4.5' },
];

export const getOpencodeProvider = (id: string): OpencodeProviderOption | undefined => OPENCODE_PROVIDERS.find((p) => p.id === id);
