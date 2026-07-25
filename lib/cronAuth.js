/**
 * Protect cron/admin endpoints with CRON_SECRET.
 * Accepts ?token= or Authorization: Bearer (Vercel Cron sends the latter).
 * In production/Vercel, CRON_SECRET must be set.
 */
export function assertCronAuth(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      res.status(503).json({ error: 'CRON_SECRET not configured' });
      return false;
    }
    return true; // local dev without secret
  }

  const bearer = req.headers.authorization;
  const tokenOk =
    req.query.token === cronSecret ||
    bearer === `Bearer ${cronSecret}`;

  if (!tokenOk) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
