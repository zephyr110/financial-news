import { fetchMarketData, saveMarketData, runBacktest } from '../../../lib/market';
import { assertCronAuth } from '../../../lib/cronAuth';
import { defaultBatchId, withPipelineRun } from '../../../lib/pipeline';

/**
 * Phase 4: Fetch market data + run backtest.
 * GET /api/cron/fetch-market?batch=<optional>
 */
export default async function handler(req, res) {
  if (!assertCronAuth(req, res)) return;

  try {
    const batchId = typeof req.query.batch === 'string' ? req.query.batch : defaultBatchId();
    const result = await withPipelineRun(
      'fetch-market',
      batchId,
      async () => {
        const rows = await fetchMarketData();
        const saved = await saveMarketData(rows);
        const btResult = await runBacktest();
        return { market_rows: saved, backtest_pairs: btResult.pairs };
      },
      (r) => r.market_rows + r.backtest_pairs
    );
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/fetch-market] Error:', error);
    res.status(500).json({ error: 'Market data fetch failed' });
  }
}
