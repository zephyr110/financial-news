import { getUnanalyzedNews, insertAnalysis } from './db.js';
import { LLM_CONFIG, describeProvider } from './llm/config.js';
import { chatCompletion, getUsageStats, getCostEstimate } from './llm/client.js';
import { SCORE_TO_IMPACT } from './constants.js';

// Re-export for backward compatibility (used by /api/cron/stats)
export { getUsageStats, getCostEstimate };

// --- System Prompt ---

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

// --- LLM Call ---

async function callLLM(newsItems) {
  const userMessages = newsItems.map((item, i) =>
    `[新闻${i + 1}]\n${item.content}`
  ).join('\n\n');

  const { content, usage } = await chatCompletion({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `请对以下${newsItems.length}条财经快讯逐一评分：\n\n${userMessages}\n\n请以JSON数组格式返回，每个元素对应一条新闻，按输入顺序排列。`,
  });

  console.log(`[analyze] ${newsItems.length} items, tokens:`, usage?.total_tokens);
  return parseAnalysisResponse(content, newsItems);
}

// --- Response Parsing ---

function parseAnalysisResponse(content, newsItems) {
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try { parsed = JSON.parse(match[1]); } catch { /* fall through */ }
    }
    if (!parsed) {
      const arrMatch = content.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        try { parsed = JSON.parse(arrMatch[0]); } catch { /* fall through */ }
      }
    }
  }

  if (!parsed) {
    console.error('[analyze] Failed to parse LLM response:', content.slice(0, 300));
    return newsItems.map(() => ({ _parseError: true }));
  }

  const results = Array.isArray(parsed) ? parsed : [parsed];
  while (results.length < newsItems.length) {
    results.push({ _incomplete: true });
  }

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

function scoreToImpact(score) {
  return SCORE_TO_IMPACT[score] || 'noise';
}

// --- Main Analysis Function ---

export async function analyzeUnanalyzedNews(batchSize = 15, maxBatches = 10) {
  if (!LLM_CONFIG.apiKey) {
    throw new Error('LLM_API_KEY not configured. Set LLM_API_KEY (or DEEPSEEK_API_KEY / ANTHROPIC_AUTH_TOKEN) environment variable.');
  }

  const unanalyzed = await getUnanalyzedNews(batchSize * maxBatches);
  if (unanalyzed.length === 0) {
    console.log('[analyze] No unanalyzed news.');
    return { analyzed: 0, errors: 0 };
  }

  console.log(`[analyze] Provider: ${describeProvider()}`);
  console.log(`[analyze] Processing ${unanalyzed.length} unanalyzed items...`);

  let analyzed = 0;
  let errors = 0;

  for (let i = 0; i < unanalyzed.length; i += batchSize) {
    const batch = unanalyzed.slice(i, i + batchSize);
    try {
      const results = await callLLM(batch);

      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const result = results[j];
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
            deep_analysis: null,
            tags: null,
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
    }

    if (i + batchSize < unanalyzed.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`[analyze] Done: ${analyzed} analyzed, ${errors} errors`);
  return { analyzed, errors };
}
