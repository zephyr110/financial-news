import { getUnanalyzedNews, insertAnalysis } from './db.js';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
// Prefer DEEPSEEK_API_KEY; ANTHROPIC_AUTH_TOKEN allowed for local keychain/zshrc setups
const API_KEY = process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;

// Track token usage (for Task 5: Cost Logging)
export const usageLog = [];
export function getUsageStats() {
  const total = usageLog.reduce(
    (acc, e) => ({
      prompt_tokens: acc.prompt_tokens + (e.usage?.prompt_tokens || 0),
      completion_tokens: acc.completion_tokens + (e.usage?.completion_tokens || 0),
      total_tokens: acc.total_tokens + (e.usage?.total_tokens || 0),
      calls: acc.calls + 1,
      errors: acc.errors + (e.error ? 1 : 0),
    }),
    { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, calls: 0, errors: 0 }
  );
  return total;
}

/**
 * Estimate daily cost based on DeepSeek V4 pricing.
 * Pricing: ~¥1/M input tokens, ~¥2/M output tokens
 */
export function getCostEstimate() {
  const stats = getUsageStats();
  const inputCost = (stats.prompt_tokens / 1_000_000) * 1;
  const outputCost = (stats.completion_tokens / 1_000_000) * 2;
  return {
    ...stats,
    estimated_cost_rmb: Math.round((inputCost + outputCost) * 1000) / 1000,
    input_cost_rmb: Math.round(inputCost * 1000) / 1000,
    output_cost_rmb: Math.round(outputCost * 1000) / 1000,
  };
}

// --- LLM Call ---

const SYSTEM_PROMPT = `你是一个A股政策-行业信号识别器。

对输入的财经快讯，输出严格JSON：

{
  "signal_score": <1-5>,
  "category": "<string>",
  "sentiment": "<string>",
  "summary": "<string>",
  "reason": "<string>",
  "industries": ["<申万二级行业名>"],
  "companies": ["<A股上市公司简称>"]
}

评分标准：
- 5分: 国务院/中央级别政策、重大地缘事件、行业颠覆性变化
- 4分: 部委级政策、重要产业规划、龙头公司重大公告、国际关系变化
- 3分: 行业数据发布、公司业绩预告、券商集中调研、产品价格变动
- 2分: 一般公司新闻、市场评论、常规数据更新
- 1分: 纯行情播报、重复资讯、广告推广、无实质内容

category 必须是以下之一: policy, geopolitics, industry, company, macro, market_rumor
sentiment 必须是以下之一: positive, negative, neutral, mixed
summary 一句话概括，不超过50字
reason 为什么打这个分，不超过30字`;

/**
 * Call DeepSeek V4 API to score a batch of news items.
 * Returns parsed results array, one per input item.
 */
async function callDeepSeek(newsItems) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const userMessages = newsItems.map((item, i) =>
      `[新闻${i + 1}]\n${item.content}`
    ).join('\n\n');

    const body = {
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `请对以下${newsItems.length}条财经快讯逐一评分：\n\n${userMessages}\n\n请以JSON数组格式返回，每个元素对应一条新闻，按输入顺序排列。` },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    };

    const res = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`DeepSeek API ${res.status}: ${text.slice(0, 200)}`);
    }

    const json = await res.json();

    // Log usage
    const entry = {
      timestamp: new Date().toISOString(),
      model: body.model,
      itemCount: newsItems.length,
      usage: json.usage,
    };
    usageLog.push(entry);
    console.log(`[analyze] ${newsItems.length} items, tokens:`, json.usage?.total_tokens);

    // Parse response
    const content = json.choices?.[0]?.message?.content || '';
    return parseAnalysisResponse(content, newsItems);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Parse the LLM response into structured results.
 * Handles both JSON array and individual JSON object formats.
 */
function parseAnalysisResponse(content, newsItems) {
  // Try to extract JSON array from the response
  let parsed;
  try {
    // Try direct parse first
    parsed = JSON.parse(content);
  } catch {
    // Try to extract JSON array from markdown code blocks
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try { parsed = JSON.parse(match[1]); } catch { /* fall through */ }
    }
    // Try to find array brackets
    if (!parsed) {
      const arrMatch = content.match(/\[[\s\S]*?\]/);
      if (arrMatch) {
        try { parsed = JSON.parse(arrMatch[0]); } catch { /* fall through */ }
      }
    }
  }

  if (!parsed) {
    console.error('[analyze] Failed to parse LLM response:', content.slice(0, 300));
    // Do not invent scores — callers skip insert so items stay re-analyzable
    return newsItems.map(() => ({ _parseError: true }));
  }

  // Normalize: if LLM returned a single object instead of array, wrap it
  const results = Array.isArray(parsed) ? parsed : [parsed];

  // Pad missing entries as incomplete (skip insert); truncate extras
  while (results.length < newsItems.length) {
    results.push({ _incomplete: true });
  }

  // Normalize and validate each result
  return results.slice(0, newsItems.length).map(r => {
    if (r._parseError || r._incomplete) {
      return { _parseError: !!r._parseError, _incomplete: !!r._incomplete };
    }
    return {
      signal_score: Math.max(1, Math.min(5, parseInt(r.signal_score, 10) || 1)),
      category: ['policy','geopolitics','industry','company','macro','market_rumor'].includes(r.category) ? r.category : 'macro',
      sentiment: ['positive','negative','neutral','mixed'].includes(r.sentiment) ? r.sentiment : 'neutral',
      summary: String(r.summary || '无摘要').slice(0, 50),
      reason: String(r.reason || ''),
      industries: r.industries || null,
      companies: r.companies || null,
    };
  });
}

// --- Score to impact_level mapping ---
function scoreToImpact(score) {
  const map = { 5: 'critical', 4: 'significant', 3: 'moderate', 2: 'minor', 1: 'noise' };
  return map[score] || 'noise';
}

// --- Main Analysis Function ---

/**
 * Analyze unanalyzed news in batches.
 * @param {number} batchSize - How many items to process per LLM call
 * @param {number} maxBatches - Safety limit on number of LLM calls per invocation
 * @returns {Object} { analyzed, errors }
 */
export async function analyzeUnanalyzedNews(batchSize = 15, maxBatches = 10) {
  if (!API_KEY) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }

  const unanalyzed = await getUnanalyzedNews(batchSize * maxBatches);
  if (unanalyzed.length === 0) {
    console.log('[analyze] No unanalyzed news.');
    return { analyzed: 0, errors: 0 };
  }

  console.log(`[analyze] Processing ${unanalyzed.length} unanalyzed items...`);

  let analyzed = 0;
  let errors = 0;

  // Process in batches
  for (let i = 0; i < unanalyzed.length; i += batchSize) {
    const batch = unanalyzed.slice(i, i + batchSize);
    try {
      const results = await callDeepSeek(batch);

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const result = results[j];
        // Skip failed/incomplete LLM results so news stays unanalyzed for retry
        if (!result || result._parseError || result._incomplete) {
          console.warn(
            `[analyze] Skipping news ${item.id} (${result?._parseError ? 'parse error' : 'incomplete'}): ${item.content.slice(0, 80)}`
          );
          errors++;
          continue;
        }
        try {
          await insertAnalysis({
            news_id: item.id,
            signal_score: result.signal_score,
            category: result.category,
            impact_level: scoreToImpact(result.signal_score),
            industries: result.industries || null,
            companies: result.companies || null,
            sentiment: result.sentiment,
            summary: result.summary,
            deep_analysis: null, // Phase 2
            tags: null,           // Phase 2
          });
          analyzed++;
        } catch (err) {
          console.error(`[analyze] Insert error for news ${item.id}:`, err.message);
          errors++;
        }
      }
    } catch (err) {
      console.error(`[analyze] Batch ${i / batchSize + 1} failed:`, err.message);
      errors += batch.length;
      // Continue with next batch instead of aborting
    }

    // Small delay between batches to respect rate limits
    if (i + batchSize < unanalyzed.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`[analyze] Done: ${analyzed} analyzed, ${errors} errors`);
  return { analyzed, errors };
}
