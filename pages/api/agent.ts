import { runAgentTurn } from '../../lib/agent/loop';

/**
 * 研究 Agent API（spec §10.3 阶段 B）
 *
 * POST /api/agent — 发送消息 { sessionId?, message } → 一轮研究对话
 * （GET 会话列表/历史此前未接线，为死代码，已移除）
 */
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { sessionId, message } = req.body || {};
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'message 必填' });
    }
    if (message.trim().length > 2000) {
      return res.status(400).json({ error: '消息过长（限 2000 字）' });
    }

    // 非法 sessionId（NaN/0/负数）直接 400，避免把坏值传给 DB
    const sid = sessionId != null ? Number(sessionId) : undefined;
    if (sessionId != null && (!Number.isFinite(sid) || sid <= 0)) {
      return res.status(400).json({ error: 'sessionId 非法' });
    }

    try {
      const result = await runAgentTurn({
        sessionId: sid,
        userMessage: message.trim(),
      });
      return res.status(200).json(result);
    } catch (error) {
      console.error('[api/agent] POST error:', error);
      const msg = error instanceof Error ? error.message : String(error);
      // 错误时携带已创建的 sessionId：客户端失败重试可续用同一会话（避免孤儿会话）
      const errorSessionId = (error as Error & { sessionId?: number }).sessionId;
      const extra = errorSessionId ? { sessionId: errorSessionId } : {};
      // LLM 未配置是预期内的可恢复错误，返回 503 让前端提示配置
      if (msg.includes('LLM_API_KEY')) return res.status(503).json({ error: msg, ...extra });
      return res.status(500).json({ error: '研究助手暂时不可用，请稍后再试', ...extra });
    }
  }

  res.setHeader('Allow', ['POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
