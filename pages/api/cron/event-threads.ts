import { detectEventThreads } from '../../../lib/analyze';
import { assertCronAuth } from '../../../lib/cronAuth';
import { defaultBatchId, withPipelineRun } from '../../../lib/pipeline';

/**
 * Phase 2 Step 3: Event thread detection (every 6h).
 * GET /api/cron/event-threads?batch=<optional>
 */
export default async function handler(req, res) {
  if (!assertCronAuth(req, res)) return;

  try {
    const hoursBack = parseInt(req.query.hoursBack) || 24;
    const batchId = typeof req.query.batch === 'string' ? req.query.batch : defaultBatchId();
    const result = await withPipelineRun(
      'event-threads',
      batchId,
      () => detectEventThreads(hoursBack),
      (r) => r.threads?.length || 0
    );
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/event-threads] Error:', error);
    res.status(500).json({ error: 'Event thread detection failed' });
  }
}
