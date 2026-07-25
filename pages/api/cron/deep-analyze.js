import { deepAnalyzeSignals } from '../../../lib/analyze.js';
import { assertCronAuth } from '../../../lib/cronAuth.js';

/**
 * Phase 2 Step 2: Deep entity mapping for signal >= 3 news.
 * GET /api/cron/deep-analyze
 */
export default async function handler(req, res) {
  if (!assertCronAuth(req, res)) return;

  try {
    const result = await deepAnalyzeSignals();
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('[cron/deep-analyze] Error:', error);
    res.status(500).json({ error: 'Deep analysis failed' });
  }
}
