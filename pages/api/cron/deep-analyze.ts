import { deepAnalyzeSignals } from '../../../lib/analyze';
import { assertCronAuth } from '../../../lib/cronAuth';
import { defaultBatchId, withPipelineRun } from '../../../lib/pipeline';

/**
 * Phase 2 Step 2: Deep entity mapping for signal >= 3 news.
 * GET /api/cron/deep-analyze?batch=<optional>
 */
export default async function handler(req, res) {
  if (!await assertCronAuth(req, res)) return;

  try {
    const batchId = typeof req.query.batch === 'string' ? req.query.batch : defaultBatchId();
    const result = await withPipelineRun(
      'deep-analyze',
      batchId,
      () => deepAnalyzeSignals(),
      (r) => r.analyzed
    );
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/deep-analyze] Error:', error);
    res.status(500).json({ error: 'Deep analysis failed' });
  }
}
