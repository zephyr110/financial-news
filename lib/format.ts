/**
 * Shared date/time formatting utilities.
 * Centralizes parsing logic duplicated across NewsCard and AnalysisNewsCard.
 */

const TZ = 'Asia/Shanghai';

/**
 * Parse a datetime value into a Date. Accepts Date objects, ISO strings
 * ("2026-08-19T12:34:56.789Z"), and SQLite datetime strings
 * ("2026-08-19 12:34:56", interpreted as Asia/Shanghai). Returns null on
 * anything unparseable — never throws.
 */
export function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = String(value);
  // SQLite datetime('now') 格式：无时区信息，按上海时间解释（与 create_time 一致）
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)
    ? s.replace(' ', 'T') + '+08:00'
    : s;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Parse a news item's time from either published_at or create_time.
 * @param {Object} item - { published_at?, create_time? }
 * @returns {Date|null}
 */
export function parseItemTime(item) {
  return toDate(item.published_at) ?? toDate(item.create_time);
}

/**
 * Format a datetime (Date | ISO | SQLite string) to HH:mm in Asia/Shanghai.
 */
export function formatTime(date: Date | string | null | undefined) {
  const d = toDate(date);
  if (!d) return '--:--';
  return d.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

/**
 * Format a datetime (Date | ISO | SQLite string) to MM/DD in Asia/Shanghai.
 */
export function formatDate(date: Date | string | null | undefined) {
  const d = toDate(date);
  if (!d) return '';
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', timeZone: TZ });
}

/**
 * Get a date key like "2026-07-25" from a news item for grouping.
 */
export function dateKeyFromItem(item) {
  const d = toDate(item.published_at) ?? toDate(item.create_time);
  if (!d) return 'unknown';
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

/**
 * Today's date key.
 */
export function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

/**
 * Format a date key (yyyy-mm-dd) to human-readable label.
 */
export function formatDayLabel(key) {
  if (key === 'unknown') return '未知日期';
  if (key === todayKey()) return '今天';
  const d = new Date(`${key}T12:00:00+08:00`);
  const week = d.toLocaleDateString('zh-CN', { timeZone: TZ, weekday: 'short' });
  // Include year for dates from a different year
  const thisYear = new Date().getFullYear();
  const dateYear = d.getFullYear();
  const datePart = dateYear !== thisYear ? key.replace(/-/g, '/') : key.slice(5).replace('-', '/');
  return `${datePart} · ${week}`;
}
