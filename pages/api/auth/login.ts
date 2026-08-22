import { login, sessionCookie } from '../../../lib/auth';

/** POST /api/auth/login { username, password } → 设置会话 cookie。 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '请输入账号和密码' });
  }
  const token = await login(String(username), String(password));
  if (!token) {
    return res.status(401).json({ error: '账号或密码错误' });
  }
  res.setHeader('Set-Cookie', sessionCookie(token));
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: true });
}
