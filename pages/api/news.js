import { fetchNews } from '../../lib/fetchNews';

/**
 * 新闻数据 API
 * GET /api/news
 */
export default async function handler(req, res) {
  try {
    const items = await fetchNews();

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
