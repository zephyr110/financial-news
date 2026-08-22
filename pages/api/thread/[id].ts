import { getEventThreadById } from '../../../lib/db';
import { getThreadMarketContext } from '../../../lib/market';

/**
 * GET /api/thread/[id] — 事件线索详情（成员信号 + 市场上下文）
 * P2.4：响应含 market（涉及行业今日涨跌）与 backtest（行业近 30 天回测），
 * 支撑「市场反应」叙事段。
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

    const context = await getThreadMarketContext(thread.industries);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=600');
    res.status(200).json({ ...thread, market: context.market, backtest: context.backtest });
  } catch (error) {
    console.error(`[api/thread/${id}] Error:`, error);
    res.status(500).json({ error: 'Failed to fetch event thread' });
  }
}
