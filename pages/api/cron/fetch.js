import { archiveNews } from '../../../lib/archive';

/**
 * Cron endpoint: triggers news archiving from all sources.
 * GET /api/cron/fetch
 *
 * Protected by a simple secret token to prevent abuse.
 * Set CRON_SECRET env var, call with ?token=<CRON_SECRET>
 */
export default async function handler(req, res) {
  // Simple auth check
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.query.token !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const counts = await archiveNews();
    res.status(200).json({ ok: true, ...counts });
  } catch (error) {
    console.error('[cron/fetch] Error:', error);
    res.status(500).json({ error: 'Archive fetch failed' });
  }
}
