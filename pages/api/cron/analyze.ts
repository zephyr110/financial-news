import { analyzeUnanalyzedNews } from '../../../lib/analyze';
import { assertCronAuth } from '../../../lib/cronAuth';

/**
 * Cron endpoint: triggers LLM analysis of unanalyzed news.
 * GET /api/cron/analyze
 */
export default async function handler(req, res) {
  if (!assertCronAuth(req, res)) return;

  try {
    const result = await analyzeUnanalyzedNews();
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/analyze] Error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
}
