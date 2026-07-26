/**
 * Eastmoney sector index data fetcher.
 * Fetches daily quote for 申万 industry sector indices via the quote API.
 */
import { getDb } from './db.js';

const EM_QUOTE_URL = 'https://push2.eastmoney.com/api/qt/stock/get';

// Major 申万二级行业 sector codes (secid format: 90.BKxxxx)
const SECTOR_CODES = [
  'BK0485', // 半导体
  'BK0484', // 光伏设备
  'BK0480', // 锂电池
  'BK0479', // 白酒
  'BK0469', // 消费电子
  'BK0420', // 新能源汽车
  'BK0424', // 军工
  'BK0448', // 创新药
  'BK0440', // AI
  'BK0438', // 机器人
];

/**
 * Fetch daily sector index quote data.
 * Uses secid=90.{code} to get the sector index itself (not constituent stocks).
 */
export async function fetchMarketData() {
  const allRows = [];

  for (const code of SECTOR_CODES) {
    try {
      const params = new URLSearchParams({
        secid: `90.${code}`,
        fields: 'f43,f44,f45,f46,f47,f48,f57,f58,f169,f170',
      });
      const res = await fetch(`${EM_QUOTE_URL}?${params}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://quote.eastmoney.com/' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const d = json?.data;
      if (!d || !d.f43) continue; // f43 = latest price, skip if missing

      allRows.push({
        code: d.f57,      // sector code
        name: d.f58,      // sector name
        type: 'index',    // sector index, not individual stock
        close: d.f43,     // latest price (or use f44=high, f45=low, f46=open)
        change_pct: d.f169 || d.f170, // change %
        volume: d.f47,    // volume
      });
    } catch (err) {
      console.error(`[market] Failed to fetch ${code}:`, err.message);
    }
  }

  return allRows;
}

/**
 * Save market data to DB.
 */
export async function saveMarketData(rows) {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  let inserted = 0;
  for (const row of rows) {
    try {
      const result = await db.execute({
        sql: `INSERT OR REPLACE INTO market_data (code, name, type, trade_date, close, change_pct, volume)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [row.code, row.name, row.type, today, row.close, row.change_pct, row.volume],
      });
      inserted += result.rowsAffected || 0;
    } catch (err) {
      console.error(`[market] Insert error for ${row.code}:`, err.message);
    }
  }
  console.log(`[market] Saved ${inserted} rows for ${today}`);
  return inserted;
}

/**
 * Run backtest: correlate past signals with subsequent market returns.
 */
export async function runBacktest(daysBack = 90) {
  const db = await getDb();
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  // Get high-signal industries grouped by date
  const signals = await db.execute({
    sql: `
      SELECT DATE(n.published_at) as signal_date, a.industries, a.signal_score
      FROM analysis_result a
      JOIN news_archive n ON n.id = a.news_id
      WHERE n.published_at >= ? AND a.signal_score >= 3 AND a.industries IS NOT NULL
      ORDER BY n.published_at
    `,
    args: [since],
  });

  // Group by (date, industry) and find max signal score + count
  const signalMap = new Map();
  for (const row of signals.rows) {
    let industries = [];
    try { industries = JSON.parse(row.industries); } catch { continue; }
    for (const ind of industries) {
      const key = `${row.signal_date}|${ind}`;
      const existing = signalMap.get(key);
      if (!existing || row.signal_score > existing.maxScore) {
        signalMap.set(key, {
          date: row.signal_date,
          industry: ind,
          maxScore: row.signal_score,
          count: (existing?.count || 0) + 1,
        });
      } else if (existing) {
        existing.count++;
      }
    }
  }

  // Use INSERT OR REPLACE with UNIQUE(signal_date, industry) — atomic, no DELETE needed
  for (const [, sig] of signalMap) {
    let day1 = null, day3 = null, day7 = null;

    const marketRows = await db.execute({
      sql: `SELECT trade_date, change_pct FROM market_data
            WHERE name = ? AND trade_date > ?
            ORDER BY trade_date ASC LIMIT 7`,
      args: [sig.industry, sig.date],
    });

    if (marketRows.rows.length >= 1) day1 = marketRows.rows[0].change_pct;
    if (marketRows.rows.length >= 3) day3 = marketRows.rows.slice(0, 3).reduce((s, r) => s + r.change_pct, 0);
    if (marketRows.rows.length >= 7) day7 = marketRows.rows.slice(0, 7).reduce((s, r) => s + r.change_pct, 0);

    await db.execute({
      sql: `INSERT OR REPLACE INTO backtest_result (signal_date, industry, signal_score, signal_count, day_1_return, day_3_return, day_7_return)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [sig.date, sig.industry, sig.maxScore, sig.count, day1, day3, day7],
    });
  }

  const stats = await db.execute('SELECT COUNT(*) as total FROM backtest_result');
  console.log(`[backtest] Completed: ${stats.rows[0]?.total || 0} signal-market pairs analyzed`);
  return { pairs: stats.rows[0]?.total || 0 };
}

/**
 * Get backtest summary grouped by signal score.
 */
export async function getBacktestSummary() {
  const db = await getDb();
  const result = await db.execute({
    sql: `SELECT signal_score,
            COUNT(*) as samples,
            ROUND(AVG(day_1_return), 2) as avg_d1,
            ROUND(AVG(day_3_return), 2) as avg_d3,
            ROUND(AVG(day_7_return), 2) as avg_d7,
            ROUND(SUM(CASE WHEN day_1_return > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as win_rate
          FROM backtest_result
          WHERE day_1_return IS NOT NULL
          GROUP BY signal_score
          ORDER BY signal_score DESC`,
  });
  return result.rows;
}
