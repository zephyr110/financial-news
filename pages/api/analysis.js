import { getAnalyzedNews, getAnalysisStats, getIndustryHeatmap } from '../../lib/db.js';

export default async function handler(req, res) {
  try {
    const hoursBack = parseInt(req.query.hoursBack) || 24;
    const minScore = parseInt(req.query.minScore) || 1;

    const [news, stats, heatmap] = await Promise.all([
      Promise.resolve(getAnalyzedNews({ minScore, hoursBack, limit: 200 })),
      Promise.resolve(getAnalysisStats(hoursBack)),
      Promise.resolve(getIndustryHeatmap(hoursBack)),
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
    res.status(200).json({ items, stats, heatmap });
  } catch (error) {
    console.error('Analysis API error:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
}

function safeParse(str) {
  try { return JSON.parse(str); } catch { return []; }
}
