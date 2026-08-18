/**
 * LLM Provider Configuration — Analyzer seam（spec §10.2 原则1）
 *
 * 这是"分析器接缝"的 Service Definition + Provider：
 *   - Service Definition：lib/llm/client.ts 的 chatCompletion()（OpenAI 兼容）
 *   - Provider 切换：全部由环境变量驱动，改 env 即可换模型/服务商，零代码改动
 *   - Consumer：lib/analyze.ts（信号筛选/实体映射/事件串联）、lib/agent/（研究 Agent）
 *
 * All values driven by environment variables with DeepSeek-compatible defaults.
 * To switch providers (OpenAI, Anthropic, etc.), change the env vars — no code changes needed.
 *
 * @env LLM_API_KEY        — API key (falls back to DEEPSEEK_API_KEY)
 * @env LLM_BASE_URL       — Base URL for chat completions endpoint (default: DeepSeek)
 * @env LLM_MODEL          — Model name (default: deepseek-v4-flash)
 * @env LLM_TEMPERATURE    — Sampling temperature 0-2 (default: 0.1)
 * @env LLM_MAX_TOKENS     — Max output tokens (default: 8192)
 * @env LLM_TIMEOUT_MS     — Request timeout in milliseconds (default: 60000)
 */

export const LLM_CONFIG = {
  // client 始终发送 OpenAI 兼容请求到 baseUrl（DeepSeek 默认）——ANTHROPIC_AUTH_TOKEN
  // 是 Anthropic 专属格式，不能作为 OpenAI 兼容 key 使用，移除该回退。
  apiKey: process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY,
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
