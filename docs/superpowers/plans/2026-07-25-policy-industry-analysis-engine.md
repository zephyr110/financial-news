# Policy-Industry Analysis Engine — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP analysis pipeline — archive news from 2 sources into SQLite, run LLM signal scoring, and display results on a new `/analysis` page.

**Architecture:** Layer new code under `lib/` (db, archive, analyze) with API routes as glue. Existing `/` page and Sina-only fetch path remain untouched. New `/analysis` page mirrors the existing page pattern (ISR + pull-to-refresh). DeepSeek V4 accessed via OpenAI-compatible chat completions API using `DEEPSEEK_API_KEY` env var.

**Tech Stack:** Next.js 16 + better-sqlite3 + DeepSeek V4 API + existing shadcn/ui components

**Design Spec:** `docs/superpowers/specs/2026-07-25-policy-industry-analysis-engine.md`

---

## File Map

| File | Responsibility | New/Modify |
|------|---------------|------------|
| `lib/db.js` | SQLite init, CRUD helpers for both tables | **New** |
| `lib/archive.js` | Fetch from Sina + Eastmoney, normalize, dedupe insert | **New** |
| `lib/analyze.js` | DeepSeek V4 API client, signal scoring prompt, batch processor | **New** |
| `lib/fetchNews.js` | Existing Sina-only fetch — leave untouched; archive.js wraps it | Modify (add archive call) |
| `pages/api/news.js` | Existing — leave untouched | — |
| `pages/api/cron/fetch.js` | Cron endpoint: triggers archive fetch | **New** |
| `pages/api/cron/analyze.js` | Cron endpoint: triggers LLM analysis of unanalyzed news | **New** |
| `pages/api/analysis.js` | Public API: returns analyzed news for frontend | **New** |
| `pages/analysis.js` | New analysis page (ISR + client refresh) | **New** |
| `components/AnalysisOverview.js` | Stats bar: signal count, event threads, top score | **New** |
| `components/SignalTimeline.js` | Filtered, sorted list of analyzed news | **New** |
| `components/AnalysisNewsCard.js` | NewsCard extended with signal badge, category, summary | **New** |
| `pages/index.js` | Add header tab navigation | Modify |
| `package.json` | Add better-sqlite3 dependency | Modify |
| `.env.local` | Add DEEPSEEK_API_KEY | **New** (manual step) |

---

### Task 1: Database Foundation

**Files:**
- Modify: `package.json` (add better-sqlite3)
- Create: `lib/db.js`

- [ ] **Step 1: Install better-sqlite3**

```bash
npm install better-sqlite3
```

- [ ] **Step 2: Create lib/db.js**

Create `lib/db.js` with database initialization and CRUD helpers:

```js
import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'news_archive.db');

let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS news_archive (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      source        TEXT    NOT NULL,
      source_id     TEXT    NOT NULL,
      title         TEXT,
      content       TEXT    NOT NULL,
      published_at  TEXT    NOT NULL,
      fetched_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(source, source_id)
    );

    CREATE INDEX IF NOT EXISTS idx_news_published ON news_archive(published_at);
    CREATE INDEX IF NOT EXISTS idx_news_source    ON news_archive(source);

    CREATE TABLE IF NOT EXISTS analysis_result (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      news_id       INTEGER NOT NULL UNIQUE REFERENCES news_archive(id),
      signal_score  INTEGER NOT NULL CHECK(signal_score BETWEEN 1 AND 5),
      category      TEXT    NOT NULL,
      impact_level  TEXT    NOT NULL,
      industries    TEXT,
      companies     TEXT,
      sentiment     TEXT    NOT NULL,
      summary       TEXT    NOT NULL,
      deep_analysis TEXT,
      tags          TEXT,
      related_ids   TEXT,
      event_thread_id TEXT,
      analyzed_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_analysis_score    ON analysis_result(signal_score);
    CREATE INDEX IF NOT EXISTS idx_analysis_category ON analysis_result(category);
  `);
}

// --- News CRUD ---

/** Insert a news item. Returns the row id, or null if already exists (duplicate). */
export function insertNews({ source, source_id, title, content, published_at }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO news_archive (source, source_id, title, content, published_at)
    VALUES (@source, @source_id, @title, @content, @published_at)
  `);
  const result = stmt.run({ source, source_id, title: title || null, content, published_at });
  if (result.changes === 0) return null; // duplicate
  return result.lastInsertRowid;
}

/** Get news items that haven't been analyzed yet, ordered by publish time. */
export function getUnanalyzedNews(limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT n.* FROM news_archive n
    LEFT JOIN analysis_result a ON a.news_id = n.id
    WHERE a.id IS NULL
    ORDER BY n.published_at ASC
    LIMIT ?
  `).all(limit);
}

// --- Analysis CRUD ---

/** Insert an analysis result. */
export function insertAnalysis({ news_id, signal_score, category, impact_level, industries, companies, sentiment, summary, deep_analysis, tags }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO analysis_result (news_id, signal_score, category, impact_level, industries, companies, sentiment, summary, deep_analysis, tags)
    VALUES (@news_id, @signal_score, @category, @impact_level, @industries, @companies, @sentiment, @summary, @deep_analysis, @tags)
  `);
  return stmt.run({
    news_id,
    signal_score,
    category,
    impact_level,
    industries: industries ? JSON.stringify(industries) : null,
    companies: companies ? JSON.stringify(companies) : null,
    sentiment,
    summary,
    deep_analysis: deep_analysis || null,
    tags: tags ? JSON.stringify(tags) : null,
  });
}

/** Get analyzed news with their original content, joined. */
export function getAnalyzedNews({ minScore = 1, limit = 100, hoursBack = 24 } = {}) {
  const db = getDb();
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  return db.prepare(`
    SELECT n.*, a.signal_score, a.category, a.impact_level, a.industries, a.companies,
           a.sentiment, a.summary, a.deep_analysis, a.tags, a.analyzed_at
    FROM news_archive n
    JOIN analysis_result a ON a.news_id = n.id
    WHERE a.signal_score >= ?
      AND n.published_at >= ?
    ORDER BY a.signal_score DESC, n.published_at DESC
    LIMIT ?
  `).all(minScore, since, limit);
}

/** Get overview stats for the analysis panel. */
export function getAnalysisStats(hoursBack = 24) {
  const db = getDb();
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_signals,
      COALESCE(MAX(signal_score), 0) as max_score,
      COALESCE(SUM(CASE WHEN signal_score >= 4 THEN 1 ELSE 0 END), 0) as critical_count,
      COALESCE(SUM(CASE WHEN signal_score >= 3 THEN 1 ELSE 0 END), 0) as significant_count
    FROM analysis_result a
    JOIN news_archive n ON n.id = a.news_id
    WHERE n.published_at >= ?
  `).get(since);
  return stats;
}

/** Get industry-level aggregated signal strength for the heatmap. */
export function getIndustryHeatmap(hoursBack = 24) {
  const db = getDb();
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  const rows = db.prepare(`
    SELECT a.industries, a.signal_score, a.sentiment
    FROM analysis_result a
    JOIN news_archive n ON n.id = a.news_id
    WHERE n.published_at >= ?
      AND a.signal_score >= 3
      AND a.industries IS NOT NULL
  `).all(since);

  // Aggregate in JS — each news item can have multiple industries
  const industryMap = new Map();
  for (const row of rows) {
    let industries = [];
    try { industries = JSON.parse(row.industries); } catch { continue; }
    for (const ind of industries) {
      if (!industryMap.has(ind)) {
        industryMap.set(ind, { count: 0, scoreSum: 0, positive: 0, negative: 0 });
      }
      const entry = industryMap.get(ind);
      entry.count++;
      entry.scoreSum += row.signal_score;
      if (row.sentiment === 'positive') entry.positive++;
      if (row.sentiment === 'negative') entry.negative++;
    }
  }

  return Array.from(industryMap.entries())
    .map(([name, data]) => ({
      industry: name,
      signalCount: data.count,
      avgScore: Math.round((data.scoreSum / data.count) * 10) / 10,
      sentiment: data.positive > data.negative ? 'positive' : data.negative > data.positive ? 'negative' : 'neutral',
    }))
    .sort((a, b) => b.signalCount - a.signalCount);
}
```

- [ ] **Step 3: Verify the database initializes correctly**

Create a quick test script `scripts/test-db.mjs`:

```js
import { getDb, insertNews, getUnanalyzedNews, insertAnalysis, getAnalyzedNews, getAnalysisStats } from '../lib/db.js';

const db = getDb();
console.log('Tables created:', db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));

// Test insert
const id = insertNews({
  source: 'test',
  source_id: 'test-001',
  title: 'Test News',
  content: 'This is a test financial news item about semiconductor industry.',
  published_at: new Date().toISOString(),
});
console.log('Inserted news id:', id);

// Test unanalyzed
const unanalyzed = getUnanalyzedNews();
console.log('Unanalyzed count:', unanalyzed.length);

// Test insert analysis
if (id) {
  insertAnalysis({
    news_id: id,
    signal_score: 4,
    category: 'industry',
    impact_level: 'significant',
    industries: ['半导体'],
    companies: ['中芯国际'],
    sentiment: 'positive',
    summary: '半导体行业测试摘要',
    deep_analysis: null,
    tags: ['测试'],
  });
}

// Test query
const analyzed = getAnalyzedNews();
console.log('Analyzed count:', analyzed.length);

const stats = getAnalysisStats();
console.log('Stats:', stats);

// Cleanup test data
db.prepare('DELETE FROM analysis_result WHERE news_id IN (SELECT id FROM news_archive WHERE source = ?)').run('test');
db.prepare('DELETE FROM news_archive WHERE source = ?').run('test');
console.log('Test data cleaned up.');
console.log('DB test PASSED.');
```

Run:
```bash
node scripts/test-db.mjs
```

Expected: prints table names, inserted id, counts, stats, and "DB test PASSED."

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json lib/db.js scripts/test-db.mjs
git commit -m "feat: add SQLite database foundation with news and analysis tables"
```

---

### Task 2: News Archive Service

**Files:**
- Create: `lib/archive.js`
- Create: `pages/api/cron/fetch.js`
- Modify: `lib/fetchNews.js` (add archive wrapper, keep existing function unchanged)

- [ ] **Step 1: Create lib/archive.js**

Eastmoney 7×24 global financial news endpoint and Sina endpoint wrapped into normalized fetchers:

```js
import { insertNews } from './db';

// --- Sina 7x24 (existing source, now with archiving) ---
// Uses the same API as lib/fetchNews.js but also archives to SQLite

const SINA_URL = (() => {
  const endpoint = 'https://zhibo.sina.com.cn/api/zhibo/feed';
  const params = new URLSearchParams({
    page: 1,
    page_size: 100,
    zhibo_id: 152,
    tag_id: 0,
    dire: 'f',
    dpc: 1,
    type: 0,
  });
  return endpoint + '?' + params.toString();
})();

// --- Eastmoney 7x24 Global News ---
// Endpoint documented by community; may need adjustment during testing.
// Reference: a-stock-data project, "np-weblist" endpoint
const EASTMONEY_URL = 'https://np-listapi.eastmoney.com/comm/web/NewsContentListGet';
const EASTMONEY_PARAMS = new URLSearchParams({
  client: 'web',
  count: '100',
  scanRows: '100',
  npVersion: '1.2.0',
  npCateId: '0', // 0 = all categories
  fields: 'content,title,showTime,code',
});

// --- Filters ---
const FILTER_KEYWORDS = [
  '比特币', '以太坊', '莱特币', '疫苗', '疫情', '蓬佩奥',
];

function shouldFilter(content) {
  return FILTER_KEYWORDS.some(kw => content.includes(kw));
}

// --- Normalizers ---

function normalizeSinaItem(item) {
  return {
    source: 'sina',
    source_id: String(item.id),
    title: null,
    content: item.rich_text,
    published_at: item.create_time
      ? new Date(item.create_time.replace(' ', 'T') + '+08:00').toISOString()
      : new Date().toISOString(),
  };
}

function normalizeEastmoneyItem(item) {
  // Eastmoney response format (subject to adjustment during testing):
  // { title, content, showTime, code }
  return {
    source: 'eastmoney',
    source_id: String(item.code || item.showTime + '_' + item.title?.slice(0, 20)),
    title: item.title || null,
    content: item.content || '',
    published_at: item.showTime
      ? new Date(item.showTime).toISOString()
      : new Date().toISOString(),
  };
}

// --- Fetchers ---

async function fetchSinaNews() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(SINA_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.10130',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Sina HTTP ${res.status}`);
    const json = await res.json();
    if (json?.result?.status?.code !== 0) throw new Error('Sina API non-zero status');
    return (json?.result?.data?.feed?.list || [])
      .filter(item => item.rich_text && !shouldFilter(item.rich_text))
      .map(normalizeSinaItem);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchEastmoneyNews() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const url = EASTMONEY_URL + '?' + EASTMONEY_PARAMS.toString();
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.eastmoney.com/',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Eastmoney HTTP ${res.status}`);
    const json = await res.json();
    // Eastmoney response structure varies; try common patterns
    const list = json?.data?.list || json?.data?.newsList || json?.result?.data || [];
    return list
      .filter(item => {
        const text = item.content || item.summary || '';
        return text && !shouldFilter(text);
      })
      .map(normalizeEastmoneyItem);
  } catch (err) {
    console.error('Eastmoney fetch failed:', err.message);
    return []; // Non-fatal: Sina is the primary source
  } finally {
    clearTimeout(timeout);
  }
}

// --- Main Archive Function ---

/**
 * Fetch from all sources, normalize, dedupe-insert into SQLite.
 * Returns counts per source.
 */
export async function archiveNews() {
  const counts = { sina: 0, eastmoney: 0, duplicates: 0 };

  // Fetch from both sources in parallel
  const [sinaItems, emItems] = await Promise.all([
    fetchSinaNews(),
    fetchEastmoneyNews(),
  ]);

  // Insert Sina items
  for (const item of sinaItems) {
    const id = insertNews(item);
    if (id) counts.sina++;
    else counts.duplicates++;
  }

  // Insert Eastmoney items
  for (const item of emItems) {
    const id = insertNews(item);
    if (id) counts.eastmoney++;
    else counts.duplicates++;
  }

  console.log(`[archive] sina=${counts.sina} eastmoney=${counts.eastmoney} dup=${counts.duplicates}`);
  return counts;
}
```

- [ ] **Step 2: Create /api/cron/fetch endpoint**

Create `pages/api/cron/fetch.js`:

```js
import { archiveNews } from '../../../lib/archive';

/**
 * Cron endpoint: triggers news archiving from all sources.
 * GET /api/cron/fetch
 *
 * Protected by a simple secret token to prevent abuse.
 * Set CRON_SECRET env var, call with ?token=<CRON_SECRET>
 */
export default async function handler(req, res) {
  // Simple auth check
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.query.token !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const counts = await archiveNews();
    res.status(200).json({ ok: true, ...counts });
  } catch (error) {
    console.error('[cron/fetch] Error:', error);
    res.status(500).json({ error: 'Archive fetch failed' });
  }
}
```

- [ ] **Step 3: Wire archiving into existing news flow**

Modify `lib/fetchNews.js` — keep the existing `fetchNews()` function exactly as-is (it's used by `/api/news` and `getStaticProps`), but add an archive-aware wrapper that can be called from the cron endpoint. Add at the bottom of `lib/fetchNews.js`:

```js
// Add to end of lib/fetchNews.js:
import { insertNews } from './db';

export async function fetchAndArchiveNews() {
  const items = await fetchNews();
  let archived = 0;
  for (const item of items) {
    const id = insertNews({
      source: 'sina',
      source_id: String(item.id),
      title: null,
      content: item.rich_text,
      published_at: item.create_time
        ? new Date(item.create_time.replace(' ', 'T') + '+08:00').toISOString()
        : new Date().toISOString(),
    });
    if (id) archived++;
  }
  return { items, archived };
}
```

- [ ] **Step 4: Test the archive flow**

Create `scripts/test-archive.mjs`:

```js
import { archiveNews } from '../lib/archive.js';
import { getDb } from '../lib/db.js';

console.log('Running archive test...');
const counts = await archiveNews();
console.log('Archive result:', counts);

const db = getDb();
const total = db.prepare('SELECT COUNT(*) as count FROM news_archive').get();
const bySource = db.prepare('SELECT source, COUNT(*) as count FROM news_archive GROUP BY source').all();
console.log('Total archived:', total.count);
console.log('By source:', bySource);

console.log('Archive test PASSED.');
```

Run:
```bash
node scripts/test-archive.mjs
```

Expected: prints archive counts, total > 0, source breakdown, "Archive test PASSED."

- [ ] **Step 5: Commit**

```bash
git add lib/archive.js pages/api/cron/fetch.js lib/fetchNews.js scripts/test-archive.mjs
git commit -m "feat: add news archive service with Sina + Eastmoney sources"
```

---

### Task 3: LLM Signal Screening (Step 1)

**Files:**
- Create: `lib/analyze.js`
- Create: `pages/api/cron/analyze.js`

- [ ] **Step 1: Create lib/analyze.js**

```js
import { getUnanalyzedNews, insertAnalysis } from './db';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const API_KEY = process.env.DEEPSEEK_API_KEY;

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

// --- LLM Call ---

const SYSTEM_PROMPT = `你是一个A股政策-行业信号识别器。

对输入的财经快讯，输出严格JSON：

{
  "signal_score": <1-5>,
  "category": "<string>",
  "sentiment": "<string>",
  "summary": "<string>",
  "reason": "<string>"
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
      const arrMatch = content.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        try { parsed = JSON.parse(arrMatch[0]); } catch { /* fall through */ }
      }
    }
  }

  if (!parsed) {
    console.error('[analyze] Failed to parse LLM response:', content.slice(0, 300));
    // Return default low-score results for each item
    return newsItems.map(item => ({
      signal_score: 1,
      category: 'macro',
      sentiment: 'neutral',
      summary: '解析失败',
      reason: 'LLM response parse error',
      _parseError: true,
    }));
  }

  // Normalize: if LLM returned a single object instead of array, wrap it
  const results = Array.isArray(parsed) ? parsed : [parsed];

  // Pad or truncate to match input count
  while (results.length < newsItems.length) {
    results.push({ signal_score: 1, category: 'macro', sentiment: 'neutral', summary: '缺失', reason: 'LLM未返回' });
  }

  return results.slice(0, newsItems.length);
}

// --- Score to impact_level mapping ---
function scoreToImpact(score) {
  const map = { 5: 'critical', 4: 'significant', 3: 'moderate', 2: 'minor', 1: 'noise' };
  return map[score] || 'noise';
}

// --- Main Analysis Function ---

/**
 * Analyze unanalyzed news in batches.
 * @param {number} batchSize - How many items to process per LLM call (max ~20 for reasonable response size)
 * @param {number} maxBatches - Safety limit on number of LLM calls per invocation
 * @returns {Object} { analyzed, errors }
 */
export async function analyzeUnanalyzedNews(batchSize = 15, maxBatches = 10) {
  if (!API_KEY) {
    console.error('[analyze] DEEPSEEK_API_KEY not set. Skipping analysis.');
    return { analyzed: 0, errors: 1, message: 'API key not configured' };
  }

  const unanalyzed = getUnanalyzedNews(batchSize * maxBatches);
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
        try {
          insertAnalysis({
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
```

- [ ] **Step 2: Create /api/cron/analyze endpoint**

Create `pages/api/cron/analyze.js`:

```js
import { analyzeUnanalyzedNews } from '../../../lib/analyze';

/**
 * Cron endpoint: triggers LLM analysis of unanalyzed news.
 * GET /api/cron/analyze
 */
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.query.token !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await analyzeUnanalyzedNews();
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/analyze] Error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
}
```

- [ ] **Step 3: Test the analysis pipeline**

Create `scripts/test-analyze.mjs`:

```js
import { analyzeUnanalyzedNews, getUsageStats } from '../lib/analyze.js';
import { getAnalyzedNews, getAnalysisStats } from '../lib/db.js';

// Ensure DEEPSEEK_API_KEY is set
if (!process.env.DEEPSEEK_API_KEY) {
  console.error('ERROR: DEEPSEEK_API_KEY environment variable is not set.');
  console.error('Set it with: export DEEPSEEK_API_KEY=sk-...');
  process.exit(1);
}

console.log('Running analysis test (max 2 batches)...');
const result = await analyzeUnanalyzedNews(10, 2);
console.log('Analysis result:', result);

const stats = getAnalysisStats();
console.log('Analysis stats:', stats);

const recent = getAnalyzedNews({ limit: 5 });
console.log('Recent analyzed news:');
for (const item of recent) {
  console.log(`  [${item.signal_score}] ${item.summary} (${item.category})`);
}

const usage = getUsageStats();
console.log('Token usage:', usage);

console.log('Analysis test PASSED.');
```

Run:
```bash
node scripts/test-analyze.mjs
```

Expected: analyzes unanalyzed news, prints results with scores and summaries, shows token usage.

- [ ] **Step 4: Commit**

```bash
git add lib/analyze.js pages/api/cron/analyze.js scripts/test-analyze.mjs
git commit -m "feat: add LLM signal screening pipeline with DeepSeek V4"
```

---

### Task 4: Analysis Page + Public API

**Files:**
- Create: `pages/api/analysis.js`
- Create: `pages/analysis.js`
- Create: `components/AnalysisOverview.js`
- Create: `components/SignalTimeline.js`
- Create: `components/AnalysisNewsCard.js`
- Modify: `pages/index.js` (add Tab navigation in header)

- [ ] **Step 1: Create /api/analysis public endpoint**

Create `pages/api/analysis.js`:

```js
import { getAnalyzedNews, getAnalysisStats, getIndustryHeatmap } from '../../lib/db';

/**
 * Public API: returns analyzed news and stats for the analysis panel.
 * GET /api/analysis?range=24h&minScore=3
 */
export default async function handler(req, res) {
  try {
    const hoursBack = parseInt(req.query.hoursBack) || 24;
    const minScore = parseInt(req.query.minScore) || 1;

    const [news, stats, heatmap] = await Promise.all([
      Promise.resolve(getAnalyzedNews({ minScore, hoursBack, limit: 200 })),
      Promise.resolve(getAnalysisStats(hoursBack)),
      Promise.resolve(getIndustryHeatmap(hoursBack)),
    ]);

    // Parse JSON fields for the frontend
    const items = news.map(item => ({
      ...item,
      industries: item.industries ? safeParse(item.industries) : [],
      companies: item.companies ? safeParse(item.companies) : [],
      tags: item.tags ? safeParse(item.tags) : [],
    }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ items, stats, heatmap });
  } catch (error) {
    console.error('Analysis API error:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
}

function safeParse(str) {
  try { return JSON.parse(str); } catch { return []; }
}
```

- [ ] **Step 2: Create AnalysisNewsCard component**

Create `components/AnalysisNewsCard.js`:

```jsx
import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

const categoryLabels = {
  policy: '政策',
  geopolitics: '地缘',
  industry: '行业',
  company: '公司',
  macro: '宏观',
  market_rumor: '传闻',
};

const categoryColors = {
  policy: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  geopolitics: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  industry: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  company: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  macro: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  market_rumor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
};

const scoreColors = {
  5: 'bg-red-600 text-white',
  4: 'bg-orange-500 text-white',
  3: 'bg-yellow-500 text-white',
  2: 'bg-gray-400 text-white',
  1: 'bg-gray-300 text-gray-600',
};

export default function AnalysisNewsCard({ item, index }) {
  const time = item.published_at
    ? new Date(item.published_at)
    : null;

  const timeLabel =
    time && !isNaN(time.getTime())
      ? time.toLocaleTimeString("zh-CN", {
          hour12: false, hour: "2-digit", minute: "2-digit",
        })
      : "--:--";

  const dateLabel =
    time && !isNaN(time.getTime())
      ? time.toLocaleDateString("zh-CN", {
          month: "2-digit", day: "2-digit",
        })
      : "";

  return (
    <Card className="group cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Signal score badge */}
          <span className={cn(
            "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0",
            scoreColors[item.signal_score] || scoreColors[1]
          )}>
            {item.signal_score}
          </span>

          <div className="min-w-0 flex-1">
            {/* Summary (LLM-generated) */}
            <p className="text-[13px] sm:text-sm lg:text-base leading-relaxed text-foreground font-medium">
              {item.summary}
            </p>

            {/* Original content (dimmed, collapsible feel) */}
            <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground line-clamp-2">
              {item.content}
            </p>

            {/* Tags row */}
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <Badge className={cn("text-[10px] px-1.5 py-0", categoryColors[item.category])}>
                {categoryLabels[item.category] || item.category}
              </Badge>

              {item.industries?.map((ind) => (
                <Badge key={ind} variant="outline" className="text-[10px] px-1.5 py-0">
                  {ind}
                </Badge>
              ))}

              <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                {dateLabel} {timeLabel}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create AnalysisOverview component**

Create `components/AnalysisOverview.js`:

```jsx
export default function AnalysisOverview({ stats }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6">
      <StatBox label="信号新闻" value={stats.total_signals} />
      <StatBox label="重要信号" value={stats.significant_count} highlight />
      <StatBox label="最高分" value={stats.max_score} />
      <StatBox label="预警" value={stats.critical_count} warn />
    </div>
  );
}

function StatBox({ label, value, highlight, warn }) {
  return (
    <div className="bg-card border rounded-lg p-3 text-center">
      <div className={`text-xl sm:text-2xl font-bold tabular-nums ${
        warn ? 'text-red-600 dark:text-red-400' :
        highlight ? 'text-primary' : 'text-foreground'
      }`}>
        {value ?? 0}
      </div>
      <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
```

- [ ] **Step 4: Create SignalTimeline component**

Create `components/SignalTimeline.js`:

```jsx
import AnalysisNewsCard from './AnalysisNewsCard';

export default function SignalTimeline({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        暂无信号数据。等待新闻归档和分析完成...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <AnalysisNewsCard key={item.id} item={item} index={i} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create /analysis page**

Create `pages/analysis.js`:

```jsx
import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import AnalysisOverview from "../components/AnalysisOverview";
import SignalTimeline from "../components/SignalTimeline";
import ErrorBanner from "../components/ErrorBanner";
import { RefreshCw } from "lucide-react";

export default function Analysis({ stats: ssgStats, items: ssgItems, heatmap: ssgHeatmap, error: ssgError }) {
  const [items, setItems] = useState(ssgItems);
  const [stats, setStats] = useState(ssgStats);
  const [error, setError] = useState(ssgError ?? null);
  const [fetching, setFetching] = useState(false);

  const doRefresh = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/analysis?hoursBack=24");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
      setStats(data.stats || {});
    } catch (e) {
      console.error("Analysis refresh failed:", e);
      setError("数据更新失败，请稍后重试");
    } finally {
      setFetching(false);
    }
  }, []);

  // Refresh on mount to get fresh data
  useEffect(() => {
    doRefresh();
  }, [doRefresh]);

  return (
    <>
      <Head>
        <title>分析面板 — Financial News</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="政策-行业影响分析引擎" />
      </Head>

      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-[720px] lg:max-w-[960px] xl:max-w-[1200px] px-4 sm:px-6">
          {/* Header */}
          <header className="flex items-center justify-between pt-8 pb-6">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
                分析面板
              </h1>
              <p className="mt-1 text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
                AI 驱动 · 政策-行业信号识别
              </p>
            </div>
            <button
              onClick={doRefresh}
              disabled={fetching}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="刷新"
            >
              <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
            </button>
          </header>

          <hr className="border-border mb-6" />

          <ErrorBanner message={error} />

          {/* Overview stats */}
          {stats && <AnalysisOverview stats={stats} />}

          {/* Signal timeline */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">信号时间线</h2>
            <SignalTimeline items={items} />
          </section>

          <footer className="py-10 text-center text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
            <p>
              AI 分析仅供参考，不构成投资建议 · Powered by DeepSeek
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}

export async function getStaticProps() {
  try {
    // Build the absolute URL for server-side fetch
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/analysis?hoursBack=24`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      props: {
        stats: data.stats || { total_signals: 0, significant_count: 0, max_score: 0, critical_count: 0 },
        items: data.items || [],
        heatmap: data.heatmap || [],
        error: null,
      },
      revalidate: 600,
    };
  } catch (e) {
    console.error("Analysis getStaticProps error:", e);
    return {
      props: {
        stats: { total_signals: 0, significant_count: 0, max_score: 0, critical_count: 0 },
        items: [],
        heatmap: [],
        error: "暂时无法获取分析数据，请稍后刷新",
      },
      revalidate: 60,
    };
  }
}
```

- [ ] **Step 6: Add navigation tabs to existing header**

Modify `pages/index.js` — add Tab navigation in the header region. Replace the header section (lines 160-192) to include tabs:

Find the `<header>` block in `pages/index.js` and add after the closing `</header>` tag (before `<hr>`):

```jsx
{/* Navigation Tabs */}
<div className="flex gap-1 mb-4">
  <a
    href="/"
    className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground"
  >
    📰 实时快讯
  </a>
  <a
    href="/analysis"
    className="px-3 py-1.5 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
  >
    📊 分析面板
  </a>
</div>
```

Wait— the index.js page already has the header inside the container div. Let me be more precise. The tabs should appear right after `<hr className="border-border mb-6" />` on line 194, before the error banner on line 196.

In `pages/index.js`, insert after line 194 (`<hr className="border-border mb-6" />`):

```jsx
{/* Navigation Tabs */}
<div className="flex gap-1 mb-4">
  <a href="/" className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground">
    📰 实时快讯
  </a>
  <a href="/analysis" className="px-3 py-1.5 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
    📊 分析面板
  </a>
</div>
```

- [ ] **Step 7: Verify the frontend builds**

```bash
npm run build
```

Expected: build succeeds with no errors. If there are issues with `better-sqlite3` during build (native module in serverless context), confirm it only runs in API routes (server-side).

- [ ] **Step 8: Commit**

```bash
git add pages/api/analysis.js pages/analysis.js \
        components/AnalysisOverview.js components/SignalTimeline.js \
        components/AnalysisNewsCard.js pages/index.js
git commit -m "feat: add analysis page with signal timeline and public API"
```

---

### Task 5: Cost Logging + Usage Monitoring

**Files:**
- Modify: `lib/analyze.js` (enhance usage logging — already partially done in Task 3)
- Create: `pages/api/cron/stats.js` (optional: expose usage stats)

- [ ] **Step 1: Verify and enhance cost logging in analyze.js**

The `usageLog` array and `getUsageStats()` function are already in `lib/analyze.js` from Task 3. Verify they're working and add a daily cost estimate:

Add to `lib/analyze.js` after the existing `getUsageStats` function:

```js
/**
 * Estimate daily cost based on DeepSeek V4 pricing.
 * Pricing (as of 2026-07): ~¥1/M input tokens, ~¥2/M output tokens
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
```

- [ ] **Step 2: Create stats endpoint**

Create `pages/api/cron/stats.js`:

```js
import { getUsageStats, getCostEstimate } from '../../../lib/analyze';
import { getDb } from '../../../lib/db';

/**
 * Admin endpoint: returns usage stats and DB counts.
 * GET /api/cron/stats
 */
export default async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.query.token !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const db = getDb();
    const dbStats = {
      total_news: db.prepare('SELECT COUNT(*) as c FROM news_archive').get().c,
      analyzed_news: db.prepare('SELECT COUNT(*) as c FROM analysis_result').get().c,
      by_source: db.prepare('SELECT source, COUNT(*) as c FROM news_archive GROUP BY source').all(),
      by_score: db.prepare('SELECT signal_score, COUNT(*) as c FROM analysis_result GROUP BY signal_score ORDER BY signal_score DESC').all(),
    };

    const usage = getCostEstimate();

    res.status(200).json({
      database: dbStats,
      usage: {
        calls: usage.calls,
        total_tokens: usage.total_tokens,
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        errors: usage.errors,
        estimated_cost_rmb: usage.estimated_cost_rmb,
      },
    });
  } catch (error) {
    console.error('[cron/stats] Error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
}
```

- [ ] **Step 3: Test the stats endpoint**

Start the dev server and call the endpoint:

```bash
# In one terminal:
npm run dev

# In another:
curl "http://localhost:3000/api/cron/stats" | jq .
```

Expected: returns JSON with database counts, usage stats, and cost estimate.

- [ ] **Step 4: Commit**

```bash
git add lib/analyze.js pages/api/cron/stats.js
git commit -m "feat: add LLM cost logging and usage stats endpoint"
```

---

## Final Integration Check

After all 5 tasks are complete:

- [ ] **Integration test: Full pipeline**

```bash
# 1. Fetch and archive news
curl "http://localhost:3000/api/cron/fetch"

# 2. Run analysis on new items
curl "http://localhost:3000/api/cron/analyze"

# 3. Check analysis results
curl "http://localhost:3000/api/analysis?hoursBack=24" | jq '.stats'

# 4. Check usage stats
curl "http://localhost:3000/api/cron/stats" | jq .

# 5. Open the analysis page
open http://localhost:3000/analysis
```

- [ ] **Check all success criteria from spec:**
  - [ ] News archive from 2 sources running
  - [ ] Signal scoring functional
  - [ ] Analysis panel loads with data
  - [ ] Token usage being logged
  - [ ] No build errors

---

## Cron Setup (Manual, Post-Implementation)

For local development, use `node-cron` or a simple approach. Add to the project root a `scripts/scheduler.mjs`:

```js
// scripts/scheduler.mjs — simple interval-based scheduler for local dev
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const TOKEN = process.env.CRON_SECRET || '';

async function tick() {
  try {
    console.log(`[scheduler] ${new Date().toISOString()} — fetching news...`);
    await fetch(`${BASE}/api/cron/fetch?token=${TOKEN}`);
  } catch (e) { console.error('[scheduler] fetch error:', e.message); }

  try {
    console.log(`[scheduler] ${new Date().toISOString()} — analyzing...`);
    await fetch(`${BASE}/api/cron/analyze?token=${TOKEN}`);
  } catch (e) { console.error('[scheduler] analyze error:', e.message); }
}

// Run immediately, then every 60 seconds
tick();
setInterval(tick, 60_000);
console.log('[scheduler] Started. Fetching every 60s, analyzing after each fetch.');
```

Run alongside the dev server:
```bash
node scripts/scheduler.mjs
```

For production (Vercel), configure Vercel Cron Jobs to call `/api/cron/fetch` and `/api/cron/analyze` on a schedule.

---

## Environment Variables Checklist

```
# .env.local (create if not exists)
DEEPSEEK_API_KEY=sk-...        # DeepSeek V4 API key (required)
CRON_SECRET=...                # Simple token to protect cron endpoints (optional but recommended)
NEXT_PUBLIC_BASE_URL=http://localhost:3000  # Base URL for getStaticProps fetch (dev default)
```