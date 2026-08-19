import { getEventThreadById } from '../../../lib/db';

/**
 * GET /api/thread/[id] — 事件线索详情（含成员信号列表）
 */
export default async function handler(req: any, res: any) {
  const id = Number(req.query.id);

  if (!Number.isFinite(id) || id < 1) {
    return res.status(400).json({ error: 'Invalid thread ID' });
  }

  try {
    const thread = await getEventThreadById(id);

    if (!thread) {
      return res.status(404).json({ error: '事件线索不存在' });
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    res.status(200).json(thread);
  } catch (error) {
    console.error(`[api/thread/${id}] Error:`, error);
    res.status(500).json({ error: 'Failed to fetch event thread' });
  }
}
