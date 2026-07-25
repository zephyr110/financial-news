import { getCostEstimate } from '../../../lib/analyze.js';
import { getDb } from '../../../lib/db.js';
import { assertCronAuth } from '../../../lib/cronAuth.js';

/**
 * Admin endpoint: returns usage stats and DB counts.
 * GET /api/cron/stats
 */
export default async function handler(req, res) {
  if (!assertCronAuth(req, res)) return;

  try {
    const db = getDb();
    const dbStats = {
      total_news: db.prepare('SELECT COUNT(*) as c FROM news_archive').get().c,
      analyzed_news: db.prepare('SELECT COUNT(*) as c FROM analysis_result').get().c,
      by_source: db.prepare('SELECT source, COUNT(*) as c FROM news_archive GROUP BY source').all(),
      by_score: db.prepare('SELECT signal_score, COUNT(*) as c FROM analysis_result GROUP BY signal_score ORDER BY signal_score DESC').all(),
    };

    const usage = getCostEstimate();

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
    });
  } catch (error) {
    console.error('[cron/stats] Error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
}
