import { createClient } from '@libsql/client';
import path from 'path';

/**
 * Turso when TURSO_DATABASE_URL is set; otherwise local file SQLite for dev.
 * On Vercel, TURSO_DATABASE_URL is required (no ephemeral /tmp fallback).
 */
function resolveClientConfig() {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    return {
      url,
      authToken: process.env.TURSO_AUTH_TOKEN,
    };
  }
  if (process.env.VERCEL) {
    throw new Error(
      'TURSO_DATABASE_URL is required on Vercel. Create a Turso DB and set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN.'
    );
  }
  const filePath = process.env.NEWS_DB_PATH || path.join(process.cwd(), 'news_archive.db');
  return { url: `file:${filePath}` };
}

let client;
let schemaReady;

export async function getDb() {
  if (!client) {
    client = createClient(resolveClientConfig());
  }
  if (!schemaReady) {
    schemaReady = initSchema(client);
  }
  await schemaReady;
  return client;
}

async function initSchema(db) {
  await db.executeMultiple(`
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
      impact_level  TEXT    NOT NULL CHECK(impact_level IN ('critical','significant','moderate','minor','noise')),
      industries    TEXT,
      companies     TEXT,
      sentiment     TEXT    NOT NULL CHECK(sentiment IN ('positive','negative','neutral','mixed')),
      summary       TEXT    NOT NULL,
      deep_analysis TEXT,
      tags          TEXT,
      related_ids   TEXT,
      event_thread_id TEXT,
      analyzed_at   TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_analysis_score    ON analysis_result(signal_score);
    CREATE INDEX IF NOT EXISTS idx_analysis_category ON analysis_result(category);
    CREATE INDEX IF NOT EXISTS idx_analysis_news     ON analysis_result(news_id);

    CREATE TABLE IF NOT EXISTS event_threads (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      title         TEXT    NOT NULL,
      news_ids      TEXT    NOT NULL,  -- JSON: [analysis_id, ...]
      narrative     TEXT    NOT NULL,
      stage         TEXT    NOT NULL,  -- early|brewing|spreading|priced_in
      confidence    TEXT    NOT NULL,  -- high|medium
      industries    TEXT,              -- JSON: ["industry", ...]
      watch_points  TEXT,              -- JSON: ["point", ...]
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_threads_created ON event_threads(created_at);

    CREATE TABLE IF NOT EXISTS market_data (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      code        TEXT    NOT NULL,
      name        TEXT    NOT NULL,
      type        TEXT    NOT NULL CHECK(type IN ('industry','index')),
      trade_date  TEXT    NOT NULL,
      close       REAL,
      change_pct  REAL,
      volume      REAL,
      UNIQUE(code, trade_date)
    );
    CREATE INDEX IF NOT EXISTS idx_market_date ON market_data(trade_date);

    CREATE TABLE IF NOT EXISTS backtest_result (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      signal_date   TEXT NOT NULL,
      industry      TEXT NOT NULL,
      signal_score  INTEGER NOT NULL,
      signal_count  INTEGER NOT NULL,
      day_1_return  REAL,
      day_3_return  REAL,
      day_7_return  REAL,
      calculated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(signal_date, industry)
    );
  `);
}

function rowId(value) {
  if (value == null) return null;
  return typeof value === 'bigint' ? Number(value) : value;
}

// --- News CRUD ---

/** Insert a news item. Returns the row id, or null if already exists (duplicate). */
export async function insertNews({ source, source_id, title, content, published_at }) {
  const db = await getDb();
  const result = await db.execute({
    sql: `
      INSERT OR IGNORE INTO news_archive (source, source_id, title, content, published_at)
      VALUES (?, ?, ?, ?, ?)
    `,
    args: [source, source_id, title ?? null, content, published_at],
  });
  if (result.rowsAffected === 0) return null;
  return rowId(result.lastInsertRowid);
}

/** Batch insert news items. Returns count of newly inserted rows. */
export async function insertNewsBatch(items) {
  if (!items || items.length === 0) return 0;
  const db = await getDb();
  let inserted = 0;
  // Build multi-value INSERT; SQLite supports up to ~500 params per statement
  for (let i = 0; i < items.length; i += 50) {
    const batch = items.slice(i, i + 50);
    const values = batch.map(() => '(?, ?, ?, ?, ?)').join(', ');
    const args = batch.flatMap(item => [
      item.source, item.source_id, item.title ?? null, item.content, item.published_at,
    ]);
    try {
      const result = await db.execute({
        sql: `INSERT OR IGNORE INTO news_archive (source, source_id, title, content, published_at) VALUES ${values}`,
        args,
      });
      inserted += result.rowsAffected || 0;
    } catch (err) {
      console.error('[db] Batch insert error:', err.message);
    }
  }
  return inserted;
}

/** Get analyzed news (signal ≥ 3) without deep analysis for Step 2 processing. */
export async function getNeedsDeepAnalysis(limit = 30) {
  const db = await getDb();
  const result = await db.execute({
    sql: `
      SELECT n.*, a.signal_score, a.category, a.industries, a.companies, a.summary
      FROM news_archive n
      JOIN analysis_result a ON a.news_id = n.id
      WHERE a.signal_score >= 3 AND a.deep_analysis IS NULL
      ORDER BY n.published_at DESC
      LIMIT ?
    `,
    args: [limit],
  });
  return result.rows;
}

/** Get high-signal news (≥3) from the past N hours for event thread detection. */
export async function getHighSignalNews(hoursBack = 24, limit = 100) {
  const db = await getDb();
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  const result = await db.execute({
    sql: `
      SELECT n.*, a.id as analysis_id, a.signal_score, a.category, a.industries, a.companies,
             a.sentiment, a.summary, a.deep_analysis, a.tags
      FROM news_archive n
      JOIN analysis_result a ON a.news_id = n.id
      WHERE a.signal_score >= 3 AND n.published_at >= ?
      ORDER BY n.published_at DESC
      LIMIT ?
    `,
    args: [since, limit],
  });
  return result.rows;
}

/** Batch update deep analysis results for Phase 2 Step 2. */
export async function updateDeepAnalysis(newsId, { industries, companies, tags, deepAnalysis }) {
  const db = await getDb();
  return db.execute({
    sql: `UPDATE analysis_result SET industries = ?, companies = ?, tags = ?, deep_analysis = ? WHERE news_id = ?`,
    args: [
      industries ? JSON.stringify(industries) : null,
      companies ? JSON.stringify(companies) : null,
      tags ? JSON.stringify(tags) : null,
      deepAnalysis || null,
      newsId,
    ],
  });
}

/** Get news items that haven't been analyzed yet, ordered by publish time. */
export async function getUnanalyzedNews(limit = 50) {
  const db = await getDb();
  const result = await db.execute({
    sql: `
      SELECT n.* FROM news_archive n
      LEFT JOIN analysis_result a ON a.news_id = n.id
      WHERE a.id IS NULL
      ORDER BY n.published_at ASC
      LIMIT ?
    `,
    args: [limit],
  });
  return result.rows;
}

/**
 * Archived news for the home timeline.
 * @param {{ daysBack?: number, limit?: number }} opts
 */
export async function getArchivedNews({ daysBack = 7, limit = 500 } = {}) {
  const db = await getDb();
  const safeDays = Number.isFinite(daysBack) && daysBack > 0 ? daysBack : 7;
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 2000) : 500;
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
  const result = await db.execute({
    sql: `
      SELECT id, source, source_id, title, content, published_at
      FROM news_archive
      WHERE published_at >= ?
      ORDER BY published_at DESC
      LIMIT ?
    `,
    args: [since, safeLimit],
  });
  return result.rows;
}

/** Get list of distinct dates with news in the past N days. */
export async function getAvailableDates(daysBack = 7) {
  const db = await getDb();
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  const result = await db.execute({
    sql: `SELECT DISTINCT DATE(published_at) as date FROM news_archive
          WHERE published_at >= ?
          ORDER BY date DESC`,
    args: [since],
  });
  return result.rows.map(r => r.date);
}

/** Get news for a specific date. */
export async function getNewsByDate(date: string, limit = 200) {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT id, source, source_id, title, content, published_at
          FROM news_archive
          WHERE DATE(published_at) = ?
          ORDER BY published_at DESC
          LIMIT ?`,
    args: [date, limit],
  });
  return result.rows;
}

// --- Analysis CRUD ---

/** Insert an analysis result. */
export async function insertAnalysis({
  news_id, signal_score, category, impact_level, industries, companies,
  sentiment, summary, deep_analysis, tags,
}) {
  const db = await getDb();
  return db.execute({
    sql: `
      INSERT INTO analysis_result (news_id, signal_score, category, impact_level, industries, companies, sentiment, summary, deep_analysis, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(news_id) DO UPDATE SET
        signal_score = excluded.signal_score,
        category = excluded.category,
        impact_level = excluded.impact_level,
        industries = excluded.industries,
        companies = excluded.companies,
        sentiment = excluded.sentiment,
        summary = excluded.summary,
        deep_analysis = excluded.deep_analysis,
        tags = excluded.tags,
        analyzed_at = datetime('now')
    `,
    args: [
      news_id,
      signal_score,
      category,
      impact_level,
      industries ? JSON.stringify(industries) : null,
      companies ? JSON.stringify(companies) : null,
      sentiment,
      summary,
      deep_analysis || null,
      tags ? JSON.stringify(tags) : null,
    ],
  });
}

/** Get analyzed news with their original content, joined. */
export async function getAnalyzedNews({ minScore = 1, limit = 50, hoursBack = 24, cursor = 0 } = {}) {
  const db = await getDb();
  const safeHours = Number.isFinite(hoursBack) && hoursBack > 0 ? hoursBack : 24;
  const safeMin = Number.isFinite(minScore) ? Math.min(5, Math.max(1, minScore)) : 1;
  const since = new Date(Date.now() - safeHours * 60 * 60 * 1000).toISOString();
  const result = await db.execute({
    sql: `
      SELECT n.*, a.signal_score, a.category, a.impact_level, a.industries, a.companies,
             a.sentiment, a.summary, a.deep_analysis, a.tags, a.analyzed_at
      FROM news_archive n
      JOIN analysis_result a ON a.news_id = n.id
      WHERE a.signal_score >= ?
        AND n.published_at >= ?
        AND a.id < ?
      ORDER BY a.signal_score DESC, a.id DESC
      LIMIT ?
    `,
    args: [safeMin, since, cursor || 9999999, limit],
  });
  return result.rows;
}

/** Get overview stats for the analysis panel. */
export async function getAnalysisStats(hoursBack = 24) {
  const db = await getDb();
  const safeHours = Number.isFinite(hoursBack) && hoursBack > 0 ? hoursBack : 24;
  const since = new Date(Date.now() - safeHours * 60 * 60 * 1000).toISOString();
  const result = await db.execute({
    sql: `
      SELECT
        COUNT(*) as total_signals,
        COALESCE(MAX(signal_score), 0) as max_score,
        COALESCE(SUM(CASE WHEN signal_score = 5 THEN 1 ELSE 0 END), 0) as critical_count,
        COALESCE(SUM(CASE WHEN signal_score = 4 THEN 1 ELSE 0 END), 0) as significant_count
      FROM analysis_result a
      JOIN news_archive n ON n.id = a.news_id
      WHERE n.published_at >= ?
    `,
    args: [since],
  });
  return result.rows[0] || {
    total_signals: 0,
    max_score: 0,
    critical_count: 0,
    significant_count: 0,
  };
}

/** Aggregate DB counts for the admin/stats endpoint. */
export async function getDbCounts() {
  const db = await getDb();
  const [totalNews, analyzedNews, bySource, byScore] = await Promise.all([
    db.execute('SELECT COUNT(*) as c FROM news_archive'),
    db.execute('SELECT COUNT(*) as c FROM analysis_result'),
    db.execute('SELECT source, COUNT(*) as c FROM news_archive GROUP BY source'),
    db.execute('SELECT signal_score, COUNT(*) as c FROM analysis_result GROUP BY signal_score ORDER BY signal_score DESC'),
  ]);
  return {
    total_news: totalNews.rows[0]?.c ?? 0,
    analyzed_news: analyzedNews.rows[0]?.c ?? 0,
    by_source: bySource.rows,
    by_score: byScore.rows,
  };
}

/** Get industry-level aggregated signal strength for the heatmap. */
export async function getIndustryHeatmap(hoursBack = 24) {
  const db = await getDb();
  const safeHours = Number.isFinite(hoursBack) && hoursBack > 0 ? hoursBack : 24;
  const since = new Date(Date.now() - safeHours * 60 * 60 * 1000).toISOString();
  const result = await db.execute({
    sql: `
      SELECT a.industries, a.signal_score, a.sentiment
      FROM analysis_result a
      JOIN news_archive n ON n.id = a.news_id
      WHERE n.published_at >= ?
        AND a.signal_score >= 3
        AND a.industries IS NOT NULL
    `,
    args: [since],
  });

  const industryMap = new Map();
  for (const row of result.rows) {
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

/** Get hourly trend data for top industries (signal_score >= 3). */
export async function getIndustryTrend(hoursBack = 24) {
  const db = await getDb();
  const safeHours = Number.isFinite(hoursBack) && hoursBack > 0 ? hoursBack : 24;
  const since = new Date(Date.now() - safeHours * 60 * 60 * 1000).toISOString();
  const result = await db.execute({
    sql: `
      SELECT a.industries, a.signal_score, n.published_at
      FROM analysis_result a
      JOIN news_archive n ON n.id = a.news_id
      WHERE n.published_at >= ?
        AND a.signal_score >= 3
        AND a.industries IS NOT NULL
      ORDER BY n.published_at ASC
    `,
    args: [since],
  });

  // Choose bucket size and label format based on time range
  let bucketHours, labelFn;
  if (safeHours <= 48) {
    bucketHours = 2;
    labelFn = (dt) => dt.toISOString().slice(11, 16); // "10:00"
  } else if (safeHours <= 168) {
    bucketHours = 6;
    labelFn = (dt) => {
      const d = dt.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
      return `${d} ${dt.toISOString().slice(11, 16)}`; // "07/25 12:00"
    };
  } else if (safeHours <= 720) {
    bucketHours = 24;
    labelFn = (dt) => dt.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }); // "07/25"
  } else {
    bucketHours = 72;
    labelFn = (dt) => dt.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }); // "07/25"
  }

  // Group by bucket and industry
  const buckets = new Map();
  for (const row of result.rows) {
    let industries = [];
    try { industries = JSON.parse(row.industries); } catch { continue; }
    const dt = new Date(row.published_at);
    dt.setMinutes(0, 0, 0);
    dt.setHours(Math.floor(dt.getHours() / bucketHours) * bucketHours);
    if (bucketHours >= 24) dt.setHours(0);
    const key = dt.toISOString();

    for (const ind of industries) {
      if (!buckets.has(key)) buckets.set(key, new Map());
      const indMap = buckets.get(key);
      indMap.set(ind, (indMap.get(ind) || 0) + 1);
    }
  }

  // Convert to { time, [industry]: count } format
  const data = Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([iso, indMap]) => ({
      time: labelFn(new Date(iso)),
      ...Object.fromEntries(indMap),
    }));

  return data;
}

// --- Event Threads CRUD ---

/** Save detected event threads, replacing any existing ones. */
export async function saveEventThreads(threads) {
  if (!Array.isArray(threads)) return;
  const db = await getDb();
  // Clean threads older than 7 days, keep recent history
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.execute({ sql: 'DELETE FROM event_threads WHERE created_at < ?', args: [cutoff] });

  for (const t of threads) {
    // Skip if a thread with same title exists from the past 24h
    const existing = await db.execute({
      sql: 'SELECT id FROM event_threads WHERE title = ? AND created_at > ?',
      args: [t.title, new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()],
    });
    if (existing.rows.length > 0) continue;

    await db.execute({
      sql: `INSERT INTO event_threads (title, news_ids, narrative, stage, confidence, industries, watch_points)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        t.title || '未命名事件',
        JSON.stringify(t.news_ids || []),
        t.narrative || '',
        t.stage || 'early',
        t.confidence || 'medium',
        JSON.stringify(t.related_industries || []),
        JSON.stringify(t.key_watch_points || []),
      ],
    });
  }
}

/** Get recent event threads. */
export async function getEventThreads(hoursBack = 24) {
  const db = await getDb();
  const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();
  const result = await db.execute({
    sql: 'SELECT * FROM event_threads WHERE created_at >= ? ORDER BY created_at DESC',
    args: [since],
  });
  return result.rows.map(r => ({
    ...r,
    news_ids: tryParseJson(r.news_ids),
    industries: tryParseJson(r.industries),
    watch_points: tryParseJson(r.watch_points),
  }));
}

function tryParseJson(str) {
  if (!str || typeof str !== 'string') return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

// ── F2: Signal Detail ──

/**
 * Get a single signal's full detail, joining news_archive and event_threads.
 * Returns null if the signal ID does not exist.
 */
export async function getSignalById(id: number) {
  const db = await getDb();
  const result = await db.execute({
    sql: `
      SELECT a.*, n.source, n.content as news_content, n.published_at,
             et.title as thread_title, et.stage as thread_stage, et.confidence as thread_confidence,
             et.id as thread_id
      FROM analysis_result a
      JOIN news_archive n ON n.id = a.news_id
      LEFT JOIN event_threads et ON et.id = (
        SELECT e2.id FROM event_threads e2
        WHERE EXISTS (
          SELECT 1 FROM json_each(e2.news_ids) AS j WHERE j.value = a.id
        )
        ORDER BY e2.created_at DESC
        LIMIT 1
      )
      WHERE a.id = ?
    `,
    args: [id],
  });
  if (result.rows.length === 0) return null;

  const row: Record<string, unknown> = result.rows[0] as Record<string, unknown>;
  return {
    id: rowId(row.id),
    news_id: rowId(row.news_id),
    signal_score: row.signal_score,
    category: row.category,
    impact_level: row.impact_level,
    sentiment: row.sentiment,
    summary: row.summary,
    deep_analysis: row.deep_analysis || null,
    industries: tryParseJson(row.industries as string),
    companies: tryParseJson(row.companies as string),
    tags: tryParseJson(row.tags as string),
    analyzed_at: row.analyzed_at,
    // from news_archive
    source: row.source,
    content: row.news_content,
    published_at: row.published_at,
    // from event_threads (conditionally present)
    event_thread: (row.thread_id != null)
      ? {
          id: rowId(row.thread_id),
          title: row.thread_title,
          stage: row.thread_stage,
          confidence: row.thread_confidence,
        }
      : null,
  };
}

/**
 * Get signals related to the given signal — same industries or companies,
 * excluding the signal itself. Returns the most recent matches.
 */
export async function getRelatedSignals(
  id: number,
  industries: string[],
  companies: string[],
  limit = 5,
) {
  const db = await getDb();

  // Build LIKE clauses from industries and companies
  const conditions: string[] = [];
  const args: (string | number)[] = [];

  for (const ind of industries) {
    conditions.push("a.industries LIKE ? ESCAPE '\\'");
    args.push(`%${ind}%`);
  }
  for (const comp of companies) {
    conditions.push("a.companies LIKE ? ESCAPE '\\'");
    args.push(`%${comp}%`);
  }

  if (conditions.length === 0) return [];

  args.push(id, limit);

  const result = await db.execute({
    sql: `
      SELECT a.id, a.signal_score, a.category, a.industries, a.summary, n.published_at
      FROM analysis_result a
      JOIN news_archive n ON n.id = a.news_id
      WHERE (${conditions.join(" OR ")})
        AND a.id != ?
        AND a.signal_score >= 3
      ORDER BY n.published_at DESC
      LIMIT ?
    `,
    args,
  });

  return result.rows.map((row: Record<string, unknown>) => ({
    id: rowId(row.id),
    signal_score: row.signal_score,
    category: row.category,
    industries: tryParseJson(row.industries as string),
    summary: row.summary,
    published_at: row.published_at,
  }));
}

// ── F3: Search ──

/**
 * Search signals by keyword across content, summary, deep_analysis, industries, companies.
 * Supports optional score and time-range filtering with cursor-based pagination.
 */
export async function searchSignals({
  query,
  minScore = 1,
  hoursBack = 720,
  cursor,
  limit = 20,
}: {
  query: string;
  minScore?: number;
  hoursBack?: number;
  cursor?: number | null;
  limit?: number;
}) {
  const db = await getDb();
  const safeQuery = String(query).trim();
  if (safeQuery.length < 2) return { items: [], nextCursor: null, total: 0 };

  const safeHours = Number.isFinite(hoursBack) ? Math.min(hoursBack, 2160) : 720;
  const safeMin = Number.isFinite(minScore) ? Math.min(5, Math.max(1, minScore)) : 1;
  const safeLimit = Math.min(limit || 20, 50);
  const since = new Date(Date.now() - safeHours * 60 * 60 * 1000).toISOString();
  const offset = cursor || 0;

  // Escape LIKE special characters for literal matching
  const escaped = safeQuery
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
  const likePattern = `%${escaped}%`;

  const countResult = await db.execute({
    sql: `
      SELECT COUNT(*) as total
      FROM analysis_result a
      JOIN news_archive n ON n.id = a.news_id
      WHERE n.published_at >= ?
        AND a.signal_score >= ?
        AND (
          n.content LIKE ? ESCAPE '\\'
          OR a.summary LIKE ? ESCAPE '\\'
          OR a.deep_analysis LIKE ? ESCAPE '\\'
          OR a.industries LIKE ? ESCAPE '\\'
          OR a.companies LIKE ? ESCAPE '\\'
        )
    `,
    args: [since, safeMin, likePattern, likePattern, likePattern, likePattern, likePattern],
  });

  const total = (countResult.rows[0] as Record<string, unknown>)?.total as number || 0;

  const result = await db.execute({
    sql: `
      SELECT a.id, a.signal_score, a.category, a.impact_level, a.industries, a.companies,
             a.sentiment, a.summary, n.content as news_content, n.source, n.published_at
      FROM analysis_result a
      JOIN news_archive n ON n.id = a.news_id
      WHERE n.published_at >= ?
        AND a.signal_score >= ?
        AND (
          n.content LIKE ? ESCAPE '\\'
          OR a.summary LIKE ? ESCAPE '\\'
          OR a.deep_analysis LIKE ? ESCAPE '\\'
          OR a.industries LIKE ? ESCAPE '\\'
          OR a.companies LIKE ? ESCAPE '\\'
        )
      ORDER BY a.signal_score DESC, n.published_at DESC
      LIMIT ? OFFSET ?
    `,
    args: [since, safeMin, likePattern, likePattern, likePattern, likePattern, likePattern, safeLimit + 1, offset],
  });

  const rows = result.rows.slice(0, safeLimit);
  const hasMore = result.rows.length > safeLimit;

  const items = rows.map((row: Record<string, unknown>) => ({
    id: rowId(row.id),
    signal_score: row.signal_score,
    category: row.category,
    impact_level: row.impact_level,
    industries: tryParseJson(row.industries as string),
    companies: tryParseJson(row.companies as string),
    sentiment: row.sentiment,
    summary: row.summary,
    source: row.source,
    published_at: row.published_at,
  }));

  return {
    items,
    nextCursor: hasMore ? offset + safeLimit : null,
    total,
  };
}

// ── F4: Stats with Trend Comparison ──

/**
 * Get analysis stats for two time windows, enabling period-over-period comparison.
 * `currentHoursBack` is the main window; `previousHoursBack` is the comparison window
 * ending where the current window begins.
 */
export async function getAnalysisStatsWithComparison(
  currentHoursBack = 24,
  previousHoursBack = 24,
) {
  const db = await getDb();
  const safeCur = Number.isFinite(currentHoursBack) ? Math.min(currentHoursBack, 720) : 24;
  const safePrev = Number.isFinite(previousHoursBack) ? Math.min(previousHoursBack, 720) : 24;
  const now = Date.now();
  const currentSince = new Date(now - safeCur * 60 * 60 * 1000).toISOString();
  const previousSince = new Date(now - (safeCur + safePrev) * 60 * 60 * 1000).toISOString();
  const previousUntil = currentSince;

  const queryStats = (since: string, until?: string) => {
    const conditions = until
      ? `n.published_at >= ? AND n.published_at < ?`
      : `n.published_at >= ?`;
    const args: string[] = until ? [since, until] : [since];
    return db.execute({
      sql: `
        SELECT
          COUNT(*) as total_signals,
          COALESCE(MAX(a.signal_score), 0) as max_score,
          COALESCE(SUM(CASE WHEN a.signal_score = 5 THEN 1 ELSE 0 END), 0) as critical_count,
          COALESCE(SUM(CASE WHEN a.signal_score = 4 THEN 1 ELSE 0 END), 0) as significant_count
        FROM analysis_result a
        JOIN news_archive n ON n.id = a.news_id
        WHERE ${conditions}
      `,
      args,
    });
  };

  const [currentResult, previousResult] = await Promise.all([
    queryStats(currentSince),
    queryStats(previousSince, previousUntil),
  ]);

  const defaultStats = { total_signals: 0, max_score: 0, critical_count: 0, significant_count: 0 };

  return {
    current: (currentResult.rows[0] as Record<string, unknown>) || defaultStats,
    previous: (previousResult.rows[0] as Record<string, unknown>) || defaultStats,
  };
}

// ── F6: Company Dimension ──

/**
 * Get company-level signal aggregation for the heatmap (top 10 companies by mention count).
 * Only includes signals with score >= 3.
 */
export async function getCompanyHeatmap(hoursBack = 24) {
  const db = await getDb();
  const safeHours = Number.isFinite(hoursBack) && hoursBack > 0 ? hoursBack : 24;
  const since = new Date(Date.now() - safeHours * 60 * 60 * 1000).toISOString();
  const result = await db.execute({
    sql: `
      SELECT a.companies, a.signal_score
      FROM analysis_result a
      JOIN news_archive n ON n.id = a.news_id
      WHERE n.published_at >= ?
        AND a.signal_score >= 3
        AND a.companies IS NOT NULL
    `,
    args: [since],
  });

  const companyMap = new Map<string, { count: number; scoreSum: number }>();
  for (const row of result.rows) {
    const companies = tryParseJson(row.companies as string);
    for (const comp of companies) {
      if (!companyMap.has(comp)) {
        companyMap.set(comp, { count: 0, scoreSum: 0 });
      }
      const entry = companyMap.get(comp)!;
      entry.count++;
      entry.scoreSum += (row.signal_score as number);
    }
  }

  return Array.from(companyMap.entries())
    .map(([name, data]) => ({
      company: name,
      signalCount: data.count,
      avgScore: Math.round((data.scoreSum / data.count) * 10) / 10,
    }))
    .sort((a, b) => b.signalCount - a.signalCount)
    .slice(0, 10);
}

// ── F7: Backtest by Industry ──

/**
 * Get backtest summary grouped by industry (instead of signal_score).
 * Only returns industries with at least 5 samples.
 */
export async function getBacktestByIndustry(daysBack = 90) {
  const db = await getDb();
  const safeDays = Number.isFinite(daysBack) ? Math.max(1, daysBack) : 90;
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const result = await db.execute({
    sql: `
      SELECT industry,
             COUNT(*) as samples,
             ROUND(AVG(day_1_return), 2) as avg_d1,
             ROUND(AVG(day_3_return), 2) as avg_d3,
             ROUND(AVG(day_7_return), 2) as avg_d7,
             ROUND(SUM(CASE WHEN day_1_return > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as win_rate
      FROM backtest_result
      WHERE day_1_return IS NOT NULL
        AND industry IS NOT NULL
        AND signal_date >= ?
      GROUP BY industry
      HAVING COUNT(*) >= 5
      ORDER BY samples DESC
    `,
    args: [since],
  });

  return result.rows.map((row: Record<string, unknown>) => ({
    industry: row.industry,
    samples: row.samples,
    avg_d1: row.avg_d1,
    avg_d3: row.avg_d3,
    avg_d7: row.avg_d7,
    win_rate: row.win_rate,
  }));
}

/**
 * Get high-score signals for ISR pre-rendering (F2: getStaticPaths).
 * Returns signal IDs with score >= minScore from the past daysBack days.
 */
export async function getHighScoreSignals({
  daysBack = 7,
  minScore = 4,
  limit = 200,
}: {
  daysBack?: number;
  minScore?: number;
  limit?: number;
} = {}) {
  const db = await getDb();
  const safeDays = Number.isFinite(daysBack) ? Math.min(daysBack, 90) : 7;
  const safeMin = Number.isFinite(minScore) ? Math.min(5, Math.max(1, minScore)) : 4;
  const safeLimit = Number.isFinite(limit) ? Math.min(limit, 500) : 200;
  const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000).toISOString();
  const result = await db.execute({
    sql: `
      SELECT a.id
      FROM analysis_result a
      JOIN news_archive n ON n.id = a.news_id
      WHERE n.published_at >= ?
        AND a.signal_score >= ?
      ORDER BY a.signal_score DESC, n.published_at DESC
      LIMIT ?
    `,
    args: [since, safeMin, safeLimit],
  });
  return result.rows.map((r: Record<string, unknown>) => ({ id: rowId(r.id) }));
}
