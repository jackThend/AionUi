/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CriterioIA: lista curada de proveedores para el OpenCode embebido. `envVar` es la
 * variable de entorno cuyo valor se referencia como `{env:...}` dentro del bloque
 * `provider.<id>.options.apiKey` de OPENCODE_CONFIG_CONTENT (ver AcpConnection.ts's
 * buildOpencodeEnv). El `id` coincide con el id de proveedor de OpenCode.
 *
 * NOTA: Anthropic directo (`anthropic/*`) NO está en la lista a propósito: en la versión
 * embebida de OpenCode (1.18.16) ese proveedor devuelve "Not Found" (endpoint roto),
 * confirmado en vivo con keys de prueba (openai/deepseek/groq/opencode sí autentican bien,
 * solo anthropic falla). Para usar modelos Claude, usar OpenCode Zen (`opencode/claude-*`)
 * u OpenRouter.
 */
export interface OpencodeProviderOption {
  id: string;
  name: string;
  envVar: string;
  defaultModel: string;
  // Endpoint OpenAI-compatible del proveedor. Se usa para listar los modelos en vivo
  // (GET {baseURL}/models con Bearer) desde Settings, vía ipcBridge.mode.fetchModelList.
  // Importante para OpenCode Go/Zen: su catálogo rota en el tiempo, así que el modelo
  // no puede quedar hardcodeado. El id que devuelve /models viene sin prefijo (ej.
  // "gpt-5.6-luna"); al guardarlo se le antepone "<providerId>/" para OPENCODE_CONFIG_CONTENT.
  baseURL: string;
  // Protocolo para listar modelos (ipcBridge.mode.fetchModelList). Por defecto 'custom'
  // (SDK OpenAI, GET {baseURL}/models con Bearer). Google/Gemini NO es OpenAI-compatible
  // para el listado: usa 'gemini' -> GET {baseURL}/models?key=API_KEY.
  platform?: 'custom' | 'gemini';
}

export const OPENCODE_PROVIDERS: OpencodeProviderOption[] = [
  // OpenCode Go / Zen: el gateway hosteado de OpenCode (una sola API key para varios modelos).
  { id: 'opencode-go', name: 'OpenCode Go', envVar: 'OPENCODE_API_KEY', defaultModel: 'opencode-go/gpt-5.6-luna', baseURL: 'https://opencode.ai/zen/go/v1' },
  { id: 'opencode', name: 'OpenCode Zen (incl. Claude)', envVar: 'OPENCODE_API_KEY', defaultModel: 'opencode/claude-sonnet-4-5', baseURL: 'https://opencode.ai/zen/v1' },
  { id: 'openai', name: 'OpenAI', envVar: 'OPENAI_API_KEY', defaultModel: 'openai/gpt-5.1', baseURL: 'https://api.openai.com/v1' },
  { id: 'google', name: 'Google Gemini', envVar: 'GEMINI_API_KEY', defaultModel: 'google/gemini-2.5-flash', baseURL: 'https://generativelanguage.googleapis.com/v1beta', platform: 'gemini' },
  { id: 'deepseek', name: 'DeepSeek', envVar: 'DEEPSEEK_API_KEY', defaultModel: 'deepseek/deepseek-chat', baseURL: 'https://api.deepseek.com/v1' },
  { id: 'groq', name: 'Groq', envVar: 'GROQ_API_KEY', defaultModel: 'groq/llama-3.3-70b-versatile', baseURL: 'https://api.groq.com/openai/v1' },
  { id: 'xai', name: 'xAI', envVar: 'XAI_API_KEY', defaultModel: 'xai/grok-4', baseURL: 'https://api.x.ai/v1' },
  { id: 'openrouter', name: 'OpenRouter', envVar: 'OPENROUTER_API_KEY', defaultModel: 'openrouter/anthropic/claude-sonnet-4.5', baseURL: 'https://openrouter.ai/api/v1' },
];

export const getOpencodeProvider = (id: string): OpencodeProviderOption | undefined => OPENCODE_PROVIDERS.find((p) => p.id === id);
