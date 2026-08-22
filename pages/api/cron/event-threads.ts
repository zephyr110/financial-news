import { detectEventThreads } from '../../../lib/analyze';
import { assertCronAuth } from '../../../lib/cronAuth';
import { defaultBatchId, withPipelineRun, isJobFresh } from '../../../lib/pipeline';

/**
 * Phase 2 Step 3: Event thread detection (every 6h).
 * GET /api/cron/event-threads?batch=<optional>
 *
 * 节流：事件线索检测调用 LLM 分析新闻（每次一批 24h 窗口）。
 * 6h 内的重复调度直接跳过，避免 QStash 30 分钟频率把 LLM/行读取用量推爆。
 */
export default async function handler(req, res) {
  if (!await assertCronAuth(req, res)) return;

  try {
    if (await isJobFresh('event-threads', 6 * 3600 * 1000)) {
      return res.status(200).json({ ok: true, skipped: 'fresh (within 6h)' });
    }
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
