/**
 * Shared date/time formatting utilities.
 * Centralizes parsing logic duplicated across NewsCard and AnalysisNewsCard.
 */

const TZ = 'Asia/Shanghai';

/**
 * Parse a news item's time from either published_at or create_time.
 * @param {Object} item - { published_at?, create_time? }
 * @returns {Date|null}
 */
export function parseItemTime(item) {
  if (item.published_at) {
    const d = new Date(item.published_at);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (item.create_time) {
    const d = new Date(String(item.create_time).replace(' ', 'T') + '+08:00');
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Format a Date to HH:mm in Asia/Shanghai.
 */
export function formatTime(date) {
  if (!date || Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('zh-CN', { hour12: false, hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

/**
 * Format a Date to MM/DD in Asia/Shanghai.
 */
export function formatDate(date) {
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', timeZone: TZ });
}

/**
 * Get a date key like "2026-07-25" from a news item for grouping.
 */
export function dateKeyFromItem(item) {
  const raw = item.published_at || item.create_time;
  if (!raw) return 'unknown';
  const d = item.published_at
    ? new Date(item.published_at)
    : new Date(String(item.create_time).replace(' ', 'T') + '+08:00');
  if (Number.isNaN(d.getTime())) return 'unknown';
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
