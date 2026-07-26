import { fetchNews } from '../../lib/fetchNews';
import { generateFeed } from '../../lib/generateFeed';

/**
 * RSS 2.0 端点
 * GET /api/rss.xml
 */
export default async function handler(req, res) {
  try {
    const items = await fetchNews();
    const feed = generateFeed(items);

    res.setHeader(
      'Cache-Control',
      's-maxage=1800, stale-while-revalidate'
    );
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).send(feed.rss2());
  } catch (error) {
    console.error('RSS XML feed error:', error);
    res.status(500).json({ error: 'Failed to generate feed' });
  }
}
