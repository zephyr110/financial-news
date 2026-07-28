import { getAnalyzedNews, getAnalysisStats, getIndustryHeatmap, getIndustryTrend, getEventThreads } from '../../lib/db';
import { safeParse } from '../../lib/utils';

function clampInt(value: any, fallback: number, min: number, max: number): number {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * GET /api/analysis?hoursBack=24&minScore=1&trendHours=168&cursor=0
 * cursor: pagination cursor (last analysis_result.id from previous page)
 */
export default async function handler(req: any, res: any) {
  try {
    const hoursBack = clampInt(req.query.hoursBack, 24, 1, 720);
    const trendHours = clampInt(req.query.trendHours, hoursBack, 1, 8760);
    const minScore = clampInt(req.query.minScore, 1, 1, 5);
    const cursor = clampInt(req.query.cursor, 0, 0, 9999999);

    const [news, stats, heatmap, trend, threads] = await Promise.all([
      getAnalyzedNews({ minScore, hoursBack, limit: 50, cursor }),
      getAnalysisStats(hoursBack),
      getIndustryHeatmap(hoursBack),
      getIndustryTrend(trendHours),
      getEventThreads(hoursBack),
    ]);

    const items = news.map((item: any) => ({
      ...item,
      industries: item.industries ? safeParse(item.industries) : [],
      companies: item.companies ? safeParse(item.companies) : [],
      tags: item.tags ? safeParse(item.tags) : [],
    }));

    // Next cursor is the smallest analysis_result.id in this batch
    const nextCursor = items.length === 50 ? items[items.length - 1].id : null;

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json({ items, stats, heatmap, trend, threads, nextCursor });
  } catch (error) {
    console.error('Analysis API error:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
}
