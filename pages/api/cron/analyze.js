import { analyzeUnanalyzedNews } from '../../../lib/analyze.js';

/**
 * Cron endpoint: triggers LLM analysis of unanalyzed news.
 * GET /api/cron/analyze
 */
export default async function handler(req, res) {
  // NOTE: If CRON_SECRET is not set, this endpoint is publicly accessible.
  // Always set CRON_SECRET in production.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.query.token !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await analyzeUnanalyzedNews();
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/analyze] Error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
}
