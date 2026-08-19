import { getDb } from '../../lib/db';

/**
 * P2.1 埋点接收端点：批量写入 event_log。
 * POST /api/events  { events: [{ name, payload, ts, session }] }
 *
 * 设计：
 * - 事件名白名单（P2.1 五个事件；后续扩展在此登记）
 * - payload 内嵌 ts/session 后整体 JSON 化存 payload 列（事件结构自描述，
 *   查询按 payload 字段展开，不新增列）
 * - 单条失败不阻断整批；端点无状态，重复投递由幂等性不敏感（计数事件，可容忍少量重复）
 */
const ALLOWED_EVENT_NAMES = new Set([
  'signal_click',
  'thread_expand',
  'industry_drill',
  'watchlist_add',
  'search_query',
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const events = req.body?.events;
  if (!Array.isArray(events) || events.length === 0 || events.length > 100) {
    return res.status(400).json({ ok: false, error: 'events must be a non-empty array (≤100)' });
  }

  const db = await getDb();
  let accepted = 0;

  for (const e of events) {
    if (!e || typeof e.name !== 'string' || !ALLOWED_EVENT_NAMES.has(e.name)) continue;
    const entityId =
      e.entityId != null && Number.isFinite(Number(e.entityId)) ? Number(e.entityId) : null;
    const payload = {
      ...(e.payload && typeof e.payload === 'object' ? e.payload : {}),
      ts: typeof e.ts === 'string' ? e.ts : new Date().toISOString(),
      session: typeof e.session === 'string' ? e.session : null,
    };
    try {
      await db.execute({
        sql: 'INSERT INTO event_log (event_type, entity_id, payload) VALUES (?, ?, ?)',
        args: [e.name, entityId, JSON.stringify(payload)],
      });
      accepted++;
    } catch (err) {
      // 单条失败不影响整批
      console.error('[events] insert failed:', err.message);
    }
  }

  res.status(200).json({ ok: true, accepted });
}
