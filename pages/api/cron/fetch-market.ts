import { fetchMarketData, saveMarketData, runBacktest, cleanBacktestData } from '../../../lib/market';
import { assertCronAuth } from '../../../lib/cronAuth';

/**
 * Phase 4: Fetch market data + run backtest.
 * GET /api/cron/fetch-market
 */
export default async function handler(req, res) {
  if (!assertCronAuth(req, res)) return;

  try {
    // Clean bad historical data before refresh
    const cleaned = await cleanBacktestData();
    const rows = await fetchMarketData();
    const saved = await saveMarketData(rows);
    const btResult = await runBacktest();
    res.status(200).json({ ok: true, market_rows: saved, backtest_pairs: btResult.pairs, cleaned });
  } catch (error) {
    console.error('[cron/fetch-market] Error:', error);
    res.status(500).json({ error: 'Market data fetch failed' });
  }
}
