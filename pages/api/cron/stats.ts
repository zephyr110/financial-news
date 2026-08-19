import { getCostEstimate } from '../../../lib/analyze';
import { getDbCounts, getEventAnalytics } from '../../../lib/db';
import { assertCronAuth } from '../../../lib/cronAuth';

/**
 * Admin endpoint: returns usage stats and DB counts.
 * GET /api/cron/stats
 */
export default async function handler(req, res) {
  if (!assertCronAuth(req, res)) return;

  try {
    const dbStats = await getDbCounts();
    const usage = getCostEstimate();
    const analytics = await getEventAnalytics(7);

    res.status(200).json({
      database: dbStats,
      usage: {
        calls: usage.calls,
        total_tokens: usage.total_tokens,
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        errors: usage.errors,
        estimated_cost_rmb: usage.estimated_cost_rmb,
      },
      analytics, // P2.1 埋点按日聚合（7 天）
    });
  } catch (error) {
    console.error('[cron/stats] Error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
}
