/**
 * LLM Provider Configuration
 *
 * All values driven by environment variables with DeepSeek-compatible defaults.
 * To switch providers (OpenAI, Anthropic, etc.), change the env vars — no code changes needed.
 *
 * @env LLM_API_KEY        — API key (falls back to DEEPSEEK_API_KEY, then ANTHROPIC_AUTH_TOKEN)
 * @env LLM_BASE_URL       — Base URL for chat completions endpoint (default: DeepSeek)
 * @env LLM_MODEL          — Model name (default: deepseek-v4-flash)
 * @env LLM_TEMPERATURE    — Sampling temperature 0-2 (default: 0.1)
 * @env LLM_MAX_TOKENS     — Max output tokens (default: 8192)
 * @env LLM_TIMEOUT_MS     — Request timeout in milliseconds (default: 60000)
 */

export const LLM_CONFIG = {
  apiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
  baseUrl: process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1',
  model: process.env.LLM_MODEL || 'deepseek-v4-flash',
  temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.1,
  maxTokens: parseInt(process.env.LLM_MAX_TOKENS, 10) || 8192,
  timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS, 10) || 60000,
};

/**
 * Resolve the full chat completions endpoint.
 */
export function getChatCompletionsUrl() {
  const base = LLM_CONFIG.baseUrl.replace(/\/+$/, '');
  if (base.endsWith('/chat/completions')) return base;
  if (base.endsWith('/v1')) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

/**
 * Pricing config for cost estimation (per million tokens).
 */
export const PRICING = {
  inputPerMillion: parseFloat(process.env.LLM_INPUT_PRICE) || 1,
  outputPerMillion: parseFloat(process.env.LLM_OUTPUT_PRICE) || 2,
  currency: process.env.LLM_PRICE_CURRENCY || '¥',
};

export function describeProvider() {
  const url = getChatCompletionsUrl();
  return `${LLM_CONFIG.model} @ ${url}`;
}
