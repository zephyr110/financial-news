import { runAgentTurn } from '../../lib/agent/loop';

/**
 * 研究 Agent API（spec §10.3 阶段 B）
 *
 * POST /api/agent — 发送消息 { sessionId?, message, stream? }
 * - stream=false（默认）：一轮结束后一次性返回 JSON
 * - stream=true：SSE 流式，事件序列：
 *   tool_start / tool_end（工具调用过程）→ delta（最终回答逐字）→ done（含完整结果）
 *   （工具调用步骤的 delta 是短 JSON，前端以 tool_start 事件截断渲染）
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  const { sessionId, message, stream } = req.body || {};
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

  const wantsStream = stream === true;

  if (!wantsStream) {
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

  // ── SSE 流式 ──
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();

  const send = (event: string, payload: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const result = await runAgentTurn({
      sessionId: sid,
      userMessage: message.trim(),
      onEvent: (e) => {
        if (e.type === 'tool_start') send('tool_start', { tool: e.tool, args: e.args });
        else if (e.type === 'tool_end') send('tool_end', { tool: e.tool, ok: e.ok, summary: e.summary });
        else if (e.type === 'delta') send('delta', { text: e.text });
        else if (e.type === 'done') {
          send('done', {
            sessionId: e.sessionId,
            reply: e.reply,
            steps: e.steps,
            toolLog: e.toolLog,
            truncated: e.truncated,
          });
        }
      },
    });
    // done 事件已在 loop 内发出；此处兜底关闭流
    void result;
    res.end();
  } catch (error) {
    console.error('[api/agent] SSE error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    const errorSessionId = (error as Error & { sessionId?: number }).sessionId;
    send('error', {
      error: msg.includes('LLM_API_KEY') ? msg : '研究助手暂时不可用，请稍后再试',
      sessionId: errorSessionId ?? null,
    });
    res.end();
  }
}
