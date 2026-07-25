import { detectEventThreads } from '../../../lib/analyze.js';
import { assertCronAuth } from '../../../lib/cronAuth.js';

/**
 * Phase 2 Step 3: Event thread detection (every 6h).
 * GET /api/cron/event-threads
 */
export default async function handler(req, res) {
  if (!assertCronAuth(req, res)) return;

  try {
    const hoursBack = parseInt(req.query.hoursBack) || 24;
    const result = await detectEventThreads(hoursBack);
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/event-threads] Error:', error);
    res.status(500).json({ error: 'Event thread detection failed' });
  }
}
