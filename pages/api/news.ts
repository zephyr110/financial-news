import { getArchivedNews, getAvailableDates, getNewsByDate } from '../../lib/db';
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
 * GET /api/news              → today's items + available past dates
 * GET /api/news?date=YYYY-MM-DD → items for a specific date
 */
export default async function handler(req, res) {
  try {
    const reqDate = req.query.date as string | undefined;

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
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
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
    } catch { /* empty */ }

    // Supplement with live data for real-time completeness
    try {
      const liveItems = await fetchLiveNews();
      if (liveItems.length > 0) {
        todayItems = dedupByContent([...liveItems, ...todayItems]);
      }
    } catch (liveErr) {
      console.error('[api/news] Live supplement failed:', liveErr.message);
    }

    // Get list of past dates (excluding today)
    const allDates = await getAvailableDates(7);
    const pastDates = allDates.filter(d => d !== today);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
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
