import { getEventMetrics } from '../../../lib/db';
import { evaluateValue } from '../../../lib/value';

/**
 * GET /api/analytics/value — P2.5 价值验证报告数据。
 * 返回 5 项指标聚合 + M2 阈值对照 + go/no-go 判定。
 */
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const days = Number(req.query.days || 7);

  try {
    const metrics = await getEventMetrics(days);
    const report = evaluateValue(metrics);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(report);
  } catch (error) {
    console.error('[api/analytics/value] Error:', error);
    res.status(500).json({ error: 'Failed to compute value metrics' });
  }
}
