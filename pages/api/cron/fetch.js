import { archiveNews } from '../../../lib/archive';
import { assertCronAuth } from '../../../lib/cronAuth.js';

/**
 * Cron endpoint: triggers news archiving from all sources.
 * GET /api/cron/fetch
 *
 * Protected by a simple secret token to prevent abuse.
 * Set CRON_SECRET env var, call with ?token=<CRON_SECRET>
 */
export default async function handler(req, res) {
  if (!assertCronAuth(req, res)) return;

  try {
    const counts = await archiveNews();
    res.status(200).json({ ok: true, ...counts });
  } catch (error) {
    console.error('[cron/fetch] Error:', error);
    res.status(500).json({ error: 'Archive fetch failed' });
  }
}
