import { getBacktestSummary } from '../../lib/market.js';

/**
 * Public API: returns backtest summary grouped by signal score.
 * GET /api/backtest
 */
export default async function handler(req, res) {
  try {
    const summary = await getBacktestSummary();
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).json({ summary });
  } catch (error) {
    console.error('Backtest API error:', error);
    res.status(500).json({ error: 'Failed to fetch backtest data' });
  }
}
