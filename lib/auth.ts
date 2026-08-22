import crypto from 'crypto';
import { getDb } from './db';

/**
 * 登录认证（单账号模式）：
 * - app_account 存 scrypt 密码哈希 + 盐；首次启动种子账号 admin / admin1234
 * - 登录成功签发随机 token 存 app_session（httpOnly cookie，30 天有效）
 * - middleware 与 /api/auth/me 校验 cookie → 账号名
 */

export const SESSION_COOKIE = 'fs_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** 无账号时创建默认测试账号（admin / admin1234）。 */
export async function ensureDefaultAccount(): Promise<void> {
  const db = await getDb();
  const row = await db.execute({ sql: 'SELECT COUNT(*) as n FROM app_account', args: [] });
  if (Number(row.rows[0].n) === 0) {
    const { hash, salt } = hashPassword('admin1234');
    await db.execute({
      sql: 'INSERT INTO app_account (username, password_hash, salt) VALUES (?, ?, ?)',
      args: ['admin', hash, salt],
    });
  }
}

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** 校验账号密码；成功签发会话 token 并返回（失败返回 null）。 */
export async function login(username: string, password: string): Promise<string | null> {
  await ensureDefaultAccount();
  const db = await getDb();
  const row = await db.execute({
    sql: 'SELECT username, password_hash, salt FROM app_account WHERE username = ?',
    args: [username.trim()],
  });
  if (row.rows.length === 0) return null;
  const acc = row.rows[0] as Record<string, unknown>;
  if (!verifyPassword(password, String(acc.password_hash), String(acc.salt))) return null;

  const token =
    (globalThis.crypto?.randomUUID?.() || `${Date.now()}${Math.random().toString(36).slice(2)}`).replace(/-/g, '');
  const expires = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  await db.execute({
    sql: 'INSERT INTO app_session (token, expires_at) VALUES (?, ?)',
    args: [token, expires],
  });
  return token;
}

/** token 有效且未过期 → 返回账号名；否则 null。 */
export async function getSessionUser(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const db = await getDb();
  const row = await db.execute({
    sql: 'SELECT a.username FROM app_session s, app_account a WHERE s.token = ? AND s.expires_at > ? LIMIT 1',
    args: [token, new Date().toISOString()],
  });
  if (row.rows.length === 0) return null;
  await db.execute({ sql: "UPDATE app_session SET expires_at = ? WHERE token = ?", args: [new Date(Date.now() + SESSION_TTL_MS).toISOString(), token] });
  return String(row.rows[0].username);
}

export async function logout(token: string | undefined | null): Promise<void> {
  if (!token) return;
  const db = await getDb();
  await db.execute({ sql: 'DELETE FROM app_session WHERE token = ?', args: [token] });
}

export interface ChangeAccountResult {
  ok: boolean;
  error?: string;
}

/**
 * 修改登录名/密码（需当前密码验证）。
 * 修改登录名时校验唯一性；密码至少 6 位。
 */
export async function changeAccount(opts: {
  currentPassword: string;
  username?: string;
  password?: string;
}): Promise<ChangeAccountResult> {
  await ensureDefaultAccount();
  const db = await getDb();
  const row = await db.execute({ sql: 'SELECT id, username, password_hash, salt FROM app_account LIMIT 1', args: [] });
  if (row.rows.length === 0) return { ok: false, error: '账号不存在' };
  const acc = row.rows[0] as Record<string, unknown>;
  if (!verifyPassword(opts.currentPassword, String(acc.password_hash), String(acc.salt))) {
    return { ok: false, error: '当前密码不正确' };
  }

  const nextUsername = opts.username?.trim() ?? String(acc.username);
  if (nextUsername.length < 2) return { ok: false, error: '登录名至少 2 个字符' };
  if (nextUsername !== String(acc.username)) {
    const exists = await db.execute({ sql: 'SELECT id FROM app_account WHERE username = ?', args: [nextUsername] });
    if (exists.rows.length > 0) return { ok: false, error: '登录名已存在' };
  }
  if (opts.password && opts.password.length < 6) {
    return { ok: false, error: '新密码至少 6 位' };
  }

  if (opts.password) {
    const { hash, salt } = hashPassword(opts.password);
    await db.execute({
      sql: 'UPDATE app_account SET username = ?, password_hash = ?, salt = ? WHERE id = ?',
      args: [nextUsername, hash, salt, acc.id],
    });
  } else {
    await db.execute({ sql: 'UPDATE app_account SET username = ? WHERE id = ?', args: [nextUsername, acc.id] });
  }
  return { ok: true };
}

/** 会话 cookie 序列化（httpOnly + SameSite=Lax，生产环境加 Secure）。 */
export function sessionCookie(token: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`;
}

export function clearSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
