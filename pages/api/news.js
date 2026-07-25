import { getArchivedNews } from '../../lib/db.js';
import { fetchNews } from '../../lib/fetchNews.js';

/**
 * 新闻数据 API — 最近 7 天归档（上限 500）
 * 若 DB 为空（新部署冷启动），自动 fallback 到新浪实时 API
 * GET /api/news
 */
export default async function handler(req, res) {
  try {
    let rows = await getArchivedNews({ daysBack: 7, limit: 500 });

    // Fallback: DB empty (fresh deploy, cron not yet populated)
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

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ items });
  } catch (error) {
    console.error('News API error:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}
