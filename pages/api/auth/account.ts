import { getSessionUser, changeAccount, SESSION_COOKIE } from '../../../lib/auth';

/** POST /api/auth/account { currentPassword, username?, password? } → 修改登录名/密码。 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }
  const username = await getSessionUser(req.cookies?.[SESSION_COOKIE]);
  if (!username) return res.status(401).json({ error: '未登录' });

  const { currentPassword, username: newUsername, password } = req.body || {};
  if (!currentPassword) return res.status(400).json({ error: '请输入当前密码' });
  if (!newUsername && !password) return res.status(400).json({ error: '没有需要修改的内容' });

  const result = await changeAccount({
    currentPassword: String(currentPassword),
    username: newUsername != null ? String(newUsername) : undefined,
    password: password != null ? String(password) : undefined,
  });
  if (!result.ok) return res.status(400).json({ error: result.error || '修改失败' });
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: true, username: newUsername?.trim() || username });
}
