import { analyzeUnanalyzedNews } from '../../../lib/analyze';
import { assertCronAuth } from '../../../lib/cronAuth';
import { defaultBatchId, withPipelineRun } from '../../../lib/pipeline';

/**
 * Cron endpoint: triggers LLM analysis of unanalyzed news.
 * GET /api/cron/analyze?batch=<optional>
 */
export default async function handler(req, res) {
  if (!await assertCronAuth(req, res)) return;

  try {
    const batchId = typeof req.query.batch === 'string' ? req.query.batch : defaultBatchId();
    const result = await withPipelineRun(
      'analyze',
      batchId,
      () => analyzeUnanalyzedNews(),
      (r) => r.analyzed
    );
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/analyze] Error:', error);
    res.status(500).json({ error: 'Analysis failed' });
  }
}
