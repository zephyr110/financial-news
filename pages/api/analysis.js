import { getAnalyzedNews, getAnalysisStats, getIndustryHeatmap, getIndustryTrend, getEventThreads } from '../../lib/db.js';
import { safeParse } from '../../lib/utils.js';

function clampInt(value, fallback, min, max) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export default async function handler(req, res) {
  try {
    const hoursBack = clampInt(req.query.hoursBack, 24, 1, 720);
    const trendHours = clampInt(req.query.trendHours, hoursBack, 1, 8760);
    const minScore = clampInt(req.query.minScore, 1, 1, 5);

    const [news, stats, heatmap, trend, threads] = await Promise.all([
      getAnalyzedNews({ minScore, hoursBack, limit: 200 }),
      getAnalysisStats(hoursBack),
      getIndustryHeatmap(hoursBack),
      getIndustryTrend(trendHours),
      getEventThreads(hoursBack),
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
    res.status(200).json({ items, stats, heatmap, trend, threads });
  } catch (error) {
    console.error('Analysis API error:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
}
