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
export async function getAnalyzedNews({ minScore = 1, limit = 100, hoursBack = 24 } = {}) {
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
      ORDER BY a.signal_score DESC, n.published_at DESC
      LIMIT ?
    `,
    args: [safeMin, since, limit],
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
