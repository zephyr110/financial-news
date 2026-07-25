import { getArchivedNews } from '../../lib/db.js';

/**
 * 新闻数据 API — 最近 7 天归档（上限 500）
 * GET /api/news
 */
export default async function handler(req, res) {
  try {
    const rows = await getArchivedNews({ daysBack: 7, limit: 500 });
    const items = rows.map((row) => ({
      id: row.id,
      rich_text: row.content,
      published_at: row.published_at,
      source: row.source,
      title: row.title,
    }));

    res.setHeader(
      'Cache-Control',
      's-maxage=60, stale-while-revalidate'
    );
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ items });
  } catch (error) {
    console.error('News API error:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
}
