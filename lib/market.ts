/**
 * Eastmoney sector index data fetcher.
 * Fetches daily quote for 申万 industry sector indices via the quote API.
 */
import { getDb } from './db';

const EM_QUOTE_URL = 'https://push2.eastmoney.com/api/qt/stock/get';

// Major 申万行业 + 热门概念 sector codes (secid format: 90.BKxxxx)
// Verified against Eastmoney push2 API on 2026-07-29
const SECTOR_CODES = [
  // 行业板块 (t:2)
  'BK0479', // 钢铁
  'BK0438', // 食品饮料
  'BK1408', // 机器人
  'BK1277', // 白酒Ⅱ
  'BK1479', // 航空运输
  'BK1480', // 机场
  'BK1592', // 通信线缆及配套
  'BK1303', // 锂电池
  'BK1338', // 消费电子零部件及组装
  'BK1325', // 半导体材料
  'BK1317', // 光伏加工设备
  'BK1368', // 钢铁管材
  'BK1233', // 军工电子Ⅱ
  'BK1528', // 其他汽车零部件
  'BK1429', // 食品及饲料添加剂
  'BK1586', // 软饮料
  // 概念板块 (t:3)
  'BK0896', // 白酒
  'BK0490', // 军工
  'BK1106', // 创新药
  'BK0900', // 新能源车
  'BK1136', // 光通信模块
  'BK0480', // 航天航空
  'BK0574', // 锂电池概念
  'BK1646', // 消费电子概念
  'BK1184', // 人形机器人
  'BK0588', // 光伏概念
  'BK1121', // 第四代半导体
  'BK1164', // AIPC
  'BK0614', // 食品安全
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

      let changePct = null;
      if (d.f170 != null) {
        // f170: 涨跌幅. For stocks it's pct*100 (e.g. 250=2.5%), but for
        // sector indices it sometimes returns index-level values. Validate.
        const raw = d.f170 / 100;
        changePct = Math.abs(raw) <= 50 ? raw : null;
      }
      // Fallback: calculate from close/open if f170 is invalid
      if (changePct == null && d.f43 != null && d.f46 != null && d.f46 !== 0) {
        changePct = ((d.f43 - d.f46) / d.f46) * 100;
      }

      // Safety clamp: reject clearly impossible values (>100% daily move)
      if (changePct != null && Math.abs(changePct) > 100) changePct = null;

      allRows.push({
        code: d.f57,      // sector code
        name: d.f58,      // sector name
        type: 'index',    // sector index, not individual stock
        close: d.f43,     // latest price (or use f44=high, f45=low, f46=open)
        change_pct: changePct,
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

    // Filter out obviously wrong change_pct values (>50% daily move is unrealistic)
    const validRows = marketRows.rows.filter(r => r.change_pct != null && Math.abs(r.change_pct) < 50);
    if (validRows.length >= 1) day1 = validRows[0].change_pct;
    if (validRows.length >= 3) day3 = validRows.slice(0, 3).reduce((s, r) => s + r.change_pct, 0);
    if (validRows.length >= 7) day7 = validRows.slice(0, 7).reduce((s, r) => s + r.change_pct, 0);

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
 * Clean bad market data and backtest results.
 */
export async function cleanBacktestData() {
  const db = await getDb();
  // Delete market_data with impossible change_pct (>50% daily move)
  const mdResult = await db.execute({
    sql: 'DELETE FROM market_data WHERE ABS(change_pct) > 50',
  });
  // Delete backtest results computed from bad market data
  const btResult = await db.execute({
    sql: `DELETE FROM backtest_result WHERE ABS(day_1_return) > 50
           OR ABS(day_3_return) > 150
           OR ABS(day_7_return) > 350`,
  });
  return {
    marketClean: mdResult.rowsAffected || 0,
    backtestClean: btResult.rowsAffected || 0,
  };
}

/**
 * Get backtest summary grouped by signal score.
 */
export async function getBacktestSummary() {
  const db = await getDb();
  const [byScore, byIndustry] = await Promise.all([
    db.execute({
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
    }),
    db.execute({
      sql: `SELECT industry, signal_score,
              COUNT(*) as samples,
              ROUND(AVG(day_1_return), 2) as avg_d1,
              ROUND(AVG(day_3_return), 2) as avg_d3,
              ROUND(SUM(CASE WHEN day_1_return > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 1) as win_rate
            FROM backtest_result
            WHERE day_1_return IS NOT NULL
            GROUP BY industry, signal_score
            HAVING COUNT(*) >= 3
            ORDER BY signal_score DESC, samples DESC`,
    }),
  ]);
  return { byScore: byScore.rows, byIndustry: byIndustry.rows };
}
