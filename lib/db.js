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

// --- News CRUD ---

/** Insert a news item. Returns the row id, or null if already exists (duplicate). */
export function insertNews({ source, source_id, title, content, published_at }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO news_archive (source, source_id, title, content, published_at)
    VALUES (@source, @source_id, @title, @content, @published_at)
  `);
  const result = stmt.run({ source, source_id, title: title ?? null, content, published_at });
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
    INSERT INTO analysis_result (news_id, signal_score, category, impact_level, industries, companies, sentiment, summary, deep_analysis, tags)
    VALUES (@news_id, @signal_score, @category, @impact_level, @industries, @companies, @sentiment, @summary, @deep_analysis, @tags)
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
      COALESCE(SUM(CASE WHEN signal_score = 5 THEN 1 ELSE 0 END), 0) as critical_count,
      COALESCE(SUM(CASE WHEN signal_score >= 4 THEN 1 ELSE 0 END), 0) as significant_count
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
