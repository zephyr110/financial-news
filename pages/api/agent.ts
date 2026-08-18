import { runAgentTurn } from '../../lib/agent/loop';
import { listAgentSessions, getAgentMessages } from '../../lib/db';

/**
 * 研究 Agent API（spec §10.3 阶段 B）
 *
 * POST /api/agent           — 发送消息 { sessionId?, message } → 一轮研究对话
 * GET  /api/agent           — 会话列表（侧栏）
 * GET  /api/agent?sessionId — 会话消息历史
 */
export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const sessionId = Number(req.query.sessionId);
      if (Number.isFinite(sessionId) && sessionId > 0) {
        const messages = await getAgentMessages(sessionId);
        return res.status(200).json({ messages });
      }
      const sessions = await listAgentSessions(20);
      return res.status(200).json({ sessions });
    } catch (error) {
      console.error('[api/agent] GET error:', error);
      return res.status(500).json({ error: '会话读取失败' });
    }
  }

  if (req.method === 'POST') {
    const { sessionId, message } = req.body || {};
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'message 必填' });
    }
    if (message.trim().length > 2000) {
      return res.status(400).json({ error: '消息过长（限 2000 字）' });
    }

    try {
      const result = await runAgentTurn({
        sessionId: sessionId != null ? Number(sessionId) : undefined,
        userMessage: message.trim(),
      });
      return res.status(200).json(result);
    } catch (error) {
      console.error('[api/agent] POST error:', error);
      const msg = error instanceof Error ? error.message : String(error);
      // LLM 未配置是预期内的可恢复错误，返回 503 让前端提示配置
      if (msg.includes('LLM_API_KEY')) return res.status(503).json({ error: msg });
      return res.status(500).json({ error: '研究助手暂时不可用，请稍后再试' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: `Method ${req.method} not allowed` });
}
