import { getArchivedNews } from '../../lib/db';
import { fetchLiveNews } from "../../lib/archive";

function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
}

/** Dedup items by content prefix (first 80 chars) to avoid live+archive duplicates */
function dedupByContent(items: any[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = (item.rich_text || item.content || '').slice(0, 80).trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default async function handler(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 500, 1000);
    let rows = await getArchivedNews({ daysBack: 7, limit });

    if (rows.length === 0) {
      console.log('[api/news] DB empty, falling back to live API...');
      const liveItems = await fetchLiveNews();
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.status(200).json({ items: liveItems });
      return;
    }

    const items = rows.map((row) => ({
      id: row.id,
      rich_text: row.content,
      published_at: row.published_at,
      source: row.source,
      title: row.title,
    }));

    const today = todayKey();
    const hasTodayData = items.some(item => {
      const d = item.published_at ? new Date(item.published_at) : null;
      return d && d.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }) === today;
    });

    // Always supplement with live data for completeness, then dedup
    let result = items;
    try {
      const liveItems = await fetchLiveNews();
      if (liveItems.length > 0) {
        result = dedupByContent([...liveItems, ...items]);
      }
    } catch (liveErr) {
      console.error('[api/news] Live supplement failed:', liveErr.message);
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ items: result });
  } catch (error) {
    console.error('News API error:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}
