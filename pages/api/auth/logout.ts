import { logout, clearSessionCookie, SESSION_COOKIE } from '../../../lib/auth';

/** POST /api/auth/logout → 删除会话并清除 cookie。 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
  const token = req.cookies?.[SESSION_COOKIE] ?? (req.headers.cookie || '').match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1];
  await logout(token);
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: true });
}
