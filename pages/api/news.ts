import { getAvailableDates, getNewsByDate, getDb } from '../../lib/db';
import { fetchLiveNews } from "../../lib/archive";

function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
}

function dedupByContent(items: any[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = (item.rich_text || item.content || '').slice(0, 80).trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Attach analysis signal info to news items via LEFT JOIN.
 * Only fetches for items that have a DB id (not live-only items with id=0).
 */
async function attachSignalData(items: any[]) {
  const ids = items
    .map((item: any) => item.id)
    .filter((id: any) => typeof id === 'number' && id > 0);

  if (ids.length === 0) return;

  const db = await getDb();
  const placeholders = ids.map(() => '?').join(',');
  const result = await db.execute({
    sql: `
      SELECT a.id as analysis_id, a.news_id, a.signal_score, a.category
      FROM analysis_result a
      WHERE a.news_id IN (${placeholders})
    `,
    args: ids,
  });

  const signalMap = new Map<number, any>();
  for (const row of result.rows) {
    const r = row as any;
    signalMap.set(r.news_id, {
      id: r.analysis_id,
      signal_score: r.signal_score,
      category: r.category,
    });
  }

  for (const item of items) {
    if (item.id > 0 && signalMap.has(item.id)) {
      item.analysis = signalMap.get(item.id);
    }
  }
}

/**
 * GET /api/news              → today's items + available past dates
 * GET /api/news?date=YYYY-MM-DD → items for a specific date
 * GET /api/news?includeSignals=1  → includes analysis signal data
 */
export default async function handler(req, res) {
  try {
    const reqDate = req.query.date as string | undefined;
    const includeSignals = req.query.includeSignals === '1' || req.query.includeSignals === 'true';

    // Specific date requested — return that date's items
    if (reqDate && /^\d{4}-\d{2}-\d{2}$/.test(reqDate)) {
      const rows = await getNewsByDate(reqDate, 200);
      const items = rows.map((row: any) => ({
        id: row.id,
        rich_text: row.content,
        published_at: row.published_at,
        source: row.source,
        title: row.title,
      }));
      if (includeSignals) {
        await attachSignalData(items);
      }
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300');
      res.status(200).json({ items, date: reqDate });
      return;
    }

    // No date — return today's data + date list
    const today = todayKey();

    // Get today's archived items
    let todayItems: any[] = [];
    try {
      const todayRows = await getNewsByDate(today, 200);
      todayItems = todayRows.map((row: any) => ({
        id: row.id,
        rich_text: row.content,
        published_at: row.published_at,
        source: row.source,
        title: row.title,
      }));
    } catch (e) {
      console.error('[api/news] Fetch today items error:', e.message);
    }

    // Supplement with live data for real-time completeness
    try {
      const liveItems = await fetchLiveNews();
      if (liveItems.length > 0) {
        todayItems = dedupByContent([...todayItems, ...liveItems]);
      }
    } catch (liveErr) {
      console.error('[api/news] Live supplement failed:', liveErr.message);
    }

    // Attach signal data if requested (after dedup so we have final ID list)
    if (includeSignals) {
      await attachSignalData(todayItems);
    }

    // Get list of past dates (excluding today)
    const allDates = await getAvailableDates(7);
    const pastDates = allDates.filter(d => d !== today);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60');
    res.status(200).json({
      todayItems,
      pastDates,
      today,
    });
  } catch (error) {
    console.error('News API error:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}
