import { fetchNews } from '../../lib/fetchNews';
import { generateFeed } from '../../lib/generateFeed';

/**
 * JSON Feed (JSON Feed v1) 端点
 * GET /api/rss.json
 */
export default async function handler(req, res) {
  try {
    const items = await fetchNews();
    const feed = generateFeed(items);

    res.setHeader(
      'Cache-Control',
      's-maxage=1800, stale-while-revalidate'
    );
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(feed.json1());
  } catch (error) {
    console.error('RSS JSON feed error:', error);
    res.status(500).json({ error: 'Failed to generate feed' });
  }
}
