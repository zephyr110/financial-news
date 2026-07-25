import { getAnalyzedNews, getAnalysisStats } from '../../lib/db.js';
import { safeParse } from '../../lib/utils.js';

export default async function handler(req, res) {
  try {
    const hoursBack = req.query.hoursBack != null ? parseInt(req.query.hoursBack) : 24;
    const minScore = req.query.minScore != null ? parseInt(req.query.minScore) : 1;

    const [news, stats] = await Promise.all([
      Promise.resolve(getAnalyzedNews({ minScore, hoursBack, limit: 200 })),
      Promise.resolve(getAnalysisStats(hoursBack)),
    ]);

    // Parse JSON fields for the frontend
    const items = news.map(item => ({
      ...item,
      industries: item.industries ? safeParse(item.industries) : [],
      companies: item.companies ? safeParse(item.companies) : [],
      tags: item.tags ? safeParse(item.tags) : [],
    }));

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ items, stats });
  } catch (error) {
    console.error('Analysis API error:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
}
