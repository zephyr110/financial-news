import { archiveNews } from '../../../lib/archive';
import { assertCronAuth } from '../../../lib/cronAuth';
import { defaultBatchId, withPipelineRun } from '../../../lib/pipeline';

/**
 * Cron endpoint: triggers news archiving from all sources.
 * GET /api/cron/fetch?batch=<optional>
 *
 * Protected by a simple secret token to prevent abuse.
 * Set CRON_SECRET env var, call with ?token=<CRON_SECRET>
 */
export default async function handler(req, res) {
  if (!await assertCronAuth(req, res)) return;

  try {
    const batchId = typeof req.query.batch === 'string' ? req.query.batch : defaultBatchId();
    const counts = await withPipelineRun(
      'fetch',
      batchId,
      () => archiveNews(),
      (r: Record<string, number>) => {
        // items = 各信源插入数之和（duplicates 不计）
        const { duplicates, ...sources } = r;
        return Object.values(sources).reduce((s, v) => s + (v || 0), 0);
      }
    );
    res.status(200).json({ ok: true, ...counts });
  } catch (error) {
    console.error('[cron/fetch] Error:', error);
    res.status(500).json({ error: 'Archive fetch failed' });
  }
}
