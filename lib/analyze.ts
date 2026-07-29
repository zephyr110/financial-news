import { getUnanalyzedNews, getNeedsDeepAnalysis, getHighSignalNews, insertAnalysis, updateDeepAnalysis, saveEventThreads } from './db';
import { LLM_CONFIG, describeProvider } from './llm/config';
import { chatCompletion, getUsageStats, getCostEstimate } from './llm/client';
import { SCORE_TO_IMPACT } from './constants';

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

// ============================================================
// Phase 2 — Step 2: Entity Mapping (deep analysis for signal ≥ 3)
// ============================================================

const DEEP_ANALYSIS_PROMPT = `你是一个A股行业分析师。对输入的重要财经新闻做深度行业和公司映射。

输出严格JSON数组，每条对应输入新闻：
{
  "industries": ["<申万二级行业名>"],
  "companies": ["<A股上市公司简称>"],
  "tags": ["<事件关键词>"],
  "deep_analysis": "<200字内，分析对相关行业的具体影响路径>"
}

要求：
- industries: 申万二级行业名，最多5个
- companies: 实际受益/受损的A股上市公司，最多5个
- tags: 事件特征标签，如"涨价""AI""供应链""政策利好"
- deep_analysis: 聚焦影响路径，非重复新闻内容`;

async function callDeepAnalysis(newsItems) {
  const userMessages = newsItems.map((item, i) =>
    `[新闻${i + 1}]\n${item.summary || item.content}`
  ).join('\n\n');

  const { content } = await chatCompletion({
    systemPrompt: DEEP_ANALYSIS_PROMPT,
    userMessage: `请对以下${newsItems.length}条重要财经新闻做深度分析：\n\n${userMessages}\n\n请以JSON数组格式返回。`,
  });

  // Own parser — preserves tags, deep_analysis (not filtered by parseAnalysisResponse)
  return parseDeepAnalysisResponse(content, newsItems);
}

function parseDeepAnalysisResponse(content, newsItems) {
  let parsed;
  try { parsed = JSON.parse(content); } catch {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) { try { parsed = JSON.parse(match[1]); } catch { /* fall through */ } }
    if (!parsed) {
      const arrMatch = content.match(/\[[\s\S]*\]/);
      if (arrMatch) { try { parsed = JSON.parse(arrMatch[0]); } catch { /* fall through */ } }
    }
  }
  if (!parsed) {
    console.error('[deep-analyze] Failed to parse:', content.slice(0, 300));
    return newsItems.map(() => ({ _parseError: true }));
  }
  const results = Array.isArray(parsed) ? parsed : [parsed];
  while (results.length < newsItems.length) results.push({ _incomplete: true });
  return results.slice(0, newsItems.length).map(r => {
    if (r._parseError || r._incomplete) return { _parseError: !!r._parseError, _incomplete: !!r._incomplete };
    return {
      industries: Array.isArray(r.industries) ? r.industries : null,
      companies: Array.isArray(r.companies) ? r.companies : null,
      tags: Array.isArray(r.tags) ? r.tags : null,
      deep_analysis: String(r.deep_analysis || ''),
    };
  });
}

export async function deepAnalyzeSignals(batchSize = 10, maxBatches = 5) {
  if (!LLM_CONFIG.apiKey) throw new Error('LLM_API_KEY not configured.');

  const pending = await getNeedsDeepAnalysis(batchSize * maxBatches);
  if (pending.length === 0) {
    console.log('[deep-analyze] No items need deep analysis.');
    return { analyzed: 0, errors: 0 };
  }

  console.log(`[deep-analyze] Processing ${pending.length} items for deep analysis...`);

  let analyzed = 0, errors = 0;

  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    try {
      const results = await callDeepAnalysis(batch);
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const result = results[j];
        if (!result || result._parseError) { errors++; continue; }
        try {
          await updateDeepAnalysis(item.id, {
            industries: result.industries,
            companies: result.companies,
            tags: result.tags,
            deepAnalysis: result.deep_analysis || result.summary,
          });
          analyzed++;
        } catch (err) {
          console.error(`[deep-analyze] Update error for news ${item.id}:`, err.message);
          errors++;
        }
      }
    } catch (err) {
      console.error(`[deep-analyze] Batch failed:`, err.message);
      errors += batch.length;
    }
    if (i + batchSize < pending.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`[deep-analyze] Done: ${analyzed} analyzed, ${errors} errors`);
  return { analyzed, errors };
}

// ============================================================
// Phase 2 — Step 3: Event Thread Detection (every 6h)
// ============================================================

const EVENT_THREAD_PROMPT = `你是一个财经事件分析师。给定过去一段时间内的重要财经新闻（已标注行业和标签），识别出"事件线索"——多条新闻指向的同一个趋势或主题。

输出JSON：
{
  "event_threads": [
    {
      "title": "<事件名称>",
      "news_ids": [<关联新闻的analysis_id列表>],
      "narrative": "<一句话描述事件发展过程>",
      "stage": "early|brewing|spreading|priced_in",
      "confidence": "high|medium",
      "related_industries": ["<行业>"],
      "key_watch_points": ["<后续关注点>"]
    }
  ]
}

要求：
- 只识别有2条以上新闻支持的事件线索
- 每个线索聚焦一个明确的主题
- stage判断标准：early(1-2条初步报道)、brewing(3-5条持续报道)、spreading(6+条多角度报道)、priced_in(市场已有充分预期)
- 最多返回5个事件线索`;

export async function detectEventThreads(hoursBack = 24) {
  if (!LLM_CONFIG.apiKey) throw new Error('LLM_API_KEY not configured.');

  const news = await getHighSignalNews(hoursBack, 80);
  if (news.length < 5) {
    console.log(`[event-threads] Not enough high-signal news (${news.length}/5 required) for thread detection.`);
    return { threads: [], highSignalCount: news.length };
  }

  console.log(`[event-threads] Analyzing ${news.length} high-signal items for event threads...`);

  const userMessages = news.map((item, i) =>
    `[ID:${item.analysis_id}][${item.category}][${item.signal_score}分] ${item.summary}`
  ).join('\n');

  try {
    const { content } = await chatCompletion({
      systemPrompt: EVENT_THREAD_PROMPT,
      userMessage: `以下是过去${hoursBack}小时内的重要财经新闻：\n\n${userMessages}\n\n请识别其中的事件线索。`,
      maxTokens: 4096,
    });

    let parsed;
    let parseMethod = 'direct';
    try { parsed = JSON.parse(content); } catch {
      const m = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      const raw = m ? m[1] : content;
      parseMethod = m ? 'code-block' : 'repair';
      try {
        const { jsonrepair } = await import('jsonrepair');
        parsed = JSON.parse(jsonrepair(raw));
      } catch { parsed = {}; parseMethod = 'fallback'; }
    }
    }
    const threads = parsed?.event_threads || [];
    console.log(`[event-threads] Detected ${threads.length} event threads (parse: ${parseMethod}).`);
    if (threads.length > 0) {
      await saveEventThreads(threads);
    }
    return {
      threads,
      highSignalCount: news.length,
      debug: { parseMethod, contentPreview: content.slice(0, 500) },
    };
  } catch (err) {
    console.error('[event-threads] Failed:', err.message);
    return { threads: [], highSignalCount: news.length, error: err.message };
  }
}
