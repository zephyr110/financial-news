/**
 * Generic OpenAI-compatible Chat Completions Client.
 *
 * Works with DeepSeek, OpenAI, Groq, Together, vLLM/Ollama, and any
 * provider that exposes an OpenAI-compatible /v1/chat/completions endpoint.
 */

import { LLM_CONFIG, getChatCompletionsUrl, PRICING } from './config.js';

export const usageLog = [];

export async function chatCompletion({ systemPrompt, userMessage, extra, temperature, maxTokens }) {
  const url = getChatCompletionsUrl();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_CONFIG.timeoutMs);

  try {
    const body = {
      model: LLM_CONFIG.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: temperature ?? LLM_CONFIG.temperature,
      max_tokens: maxTokens ?? LLM_CONFIG.maxTokens,
      ...extra,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LLM_CONFIG.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`LLM API ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = await res.json();

    const entry = {
      timestamp: new Date().toISOString(),
      model: LLM_CONFIG.model,
      usage: json.usage,
    };
    usageLog.push(entry);

    const content = json.choices?.[0]?.message?.content || '';
    return { content, usage: json.usage, model: LLM_CONFIG.model };
  } finally {
    clearTimeout(timeout);
  }
}

export function getUsageStats() {
  return usageLog.reduce(
    (acc, e) => ({
      prompt_tokens: acc.prompt_tokens + (e.usage?.prompt_tokens || 0),
      completion_tokens: acc.completion_tokens + (e.usage?.completion_tokens || 0),
      total_tokens: acc.total_tokens + (e.usage?.total_tokens || 0),
      calls: acc.calls + 1,
      errors: acc.errors + (e.error ? 1 : 0),
    }),
    { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, calls: 0, errors: 0 }
  );
}

export function getCostEstimate() {
  const stats = getUsageStats();
  const inputCost = (stats.prompt_tokens / 1_000_000) * PRICING.inputPerMillion;
  const outputCost = (stats.completion_tokens / 1_000_000) * PRICING.outputPerMillion;
  const total = Math.round((inputCost + outputCost) * 1000) / 1000;
  return {
    ...stats,
    estimated_cost: total,
    estimated_cost_rmb: total, // backward compat
    input_cost: Math.round(inputCost * 1000) / 1000,
    output_cost: Math.round(outputCost * 1000) / 1000,
    currency: PRICING.currency,
  };
}
