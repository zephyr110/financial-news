import { getArchivedNews } from '../../lib/db.js';
import { fetchNews } from '../../lib/fetchNews.js';

function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
}

/**
 * 新闻数据 API — 最近 7 天归档 + 今日实时补充
 * GET /api/news
 */
export default async function handler(req, res) {
  try {
    let rows = await getArchivedNews({ daysBack: 7, limit: 500 });

    // Fallback: DB empty (fresh deploy)
    if (rows.length === 0) {
      console.log('[api/news] DB empty, falling back to live Sina API...');
      const liveItems = await fetchNews();
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

    // Supplement: if DB has no entries from today, fetch live Sina data
    // and merge with archived data so users always see current news
    const today = todayKey();
    const hasTodayData = items.some(item => {
      const d = item.published_at ? new Date(item.published_at) : null;
      return d && d.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' }) === today;
    });

    if (!hasTodayData) {
      try {
        console.log('[api/news] No today data in DB, supplementing with live API...');
        const liveItems = await fetchNews();
        const merged = [...liveItems, ...items];
        res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.status(200).json({ items: merged });
        return;
      } catch (liveErr) {
        console.error('[api/news] Live supplement failed:', liveErr.message);
        // Fall through to return archived data
      }
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ items });
  } catch (error) {
    console.error('News API error:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}
