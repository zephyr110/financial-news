/**
 * 研究 Agent — ReactLoop 执行循环（spec §10.3 阶段 B）
 *
 * Mini-Agent 式循环 + "prompt 内 JSON 工具协议"：
 *   1. 用户消息入库，加载会话上下文（含自动压缩）
 *   2. 组装 messages → LLM
 *   3. 输出为 `{"tool":"<name>","args":{...}}` → 执行工具 → 结果回喂 → 回到 2
 *   4. 输出为纯文本 → 视为最终回答，入库并返回
 * 循环全程持久化（模型可见即记录，spec §10.2 原则2）。
 */
import { appendAgentMessage, createAgentSession, touchAgentSession, logEvent, EVENT_TYPES } from '../db';
import { chatCompletion } from '../llm/client';
import { LLM_CONFIG } from '../llm/config';
import type { AgentTurnResult } from './types';
import { getTool, buildToolPrompt } from './tools';
import { loadAgentContext } from './session';

/** 单轮最大步数（LLM 调用次数），防止失控循环 */
const MAX_STEPS = 8;
/** 工具结果文本长度上限（防止工具输出撑爆上下文） */
const TOOL_RESULT_MAX_CHARS = 3000;

export const AGENT_SYSTEM_PROMPT = `你是一个A股政策-行业研究助手（信息准备层，不做投资顾问）。

你的任务：通过调用工具，回答用户关于财经信号、政策影响、行业趋势、事件发展的问题。

工具调用协议：
- 当需要信息时，输出严格JSON（不要输出其他文字）：{"tool":"<工具名>","args":{...}}
- 当信息足够时，输出最终回答（纯文本，可使用 markdown 列表）

使用准则：
- 优先用工具获取真实数据，不要凭记忆编造新闻、日期、行业数据
- 回答要引用数据来源（信号ID、事件线索ID、时间），说明判断依据
- 区分"已确认信号"与"推测"，标注置信度
- 可以给出趋势判断（早期/发酵/扩散/定价），但禁止给出买卖建议
- 若工具没有数据，明确说明数据缺口，不要编造`;

export function tryParseToolCall(content: string): { tool?: string; args?: Record<string, unknown> } | null {
  // 兼容 ```json 代码块包裹
  const trimmed = content.trim();
  const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (match ? match[1] : trimmed).trim();
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.tool === 'string') {
      return { tool: parsed.tool, args: parsed.args && typeof parsed.args === 'object' ? parsed.args : {} };
    }
    return null;
  } catch {
    return null;
  }
}

export interface RunTurnOptions {
  sessionId?: number;
  userMessage: string;
}

/**
 * 执行一轮研究对话：入库 → 循环 → 持久化。
 * 无 sessionId 时自动创建新会话。
 */
export async function runAgentTurn(opts: RunTurnOptions): Promise<AgentTurnResult & { sessionId: number }> {
  if (!LLM_CONFIG.apiKey) {
    throw new Error('LLM_API_KEY not configured. Set LLM_API_KEY (or DEEPSEEK_API_KEY) environment variable.');
  }

  let sessionId: number;
  try {
    sessionId = opts.sessionId ?? (await createAgentSession(opts.userMessage.slice(0, 20)));
    if (opts.sessionId == null) {
      await appendAgentMessage(sessionId, 'user', opts.userMessage);
    } else {
      await appendAgentMessage(sessionId, 'user', opts.userMessage);
      await touchAgentSession(sessionId, opts.userMessage.slice(0, 20));
    }
    await logEvent(EVENT_TYPES.AGENT_QUERY, { entityId: sessionId, payload: { message: opts.userMessage.slice(0, 100) } });

    // history 已包含刚持久化的当前用户消息（loadAgentContext 在其后读取），
    // turnMessages 只承载本回合后续的工具调用/结果，避免用户消息双发。
    const history = await loadAgentContext(sessionId);
    const toolLog: AgentTurnResult['toolLog'] = [];
    const turnMessages: { role: 'user' | 'assistant'; content: string }[] = [];

    let steps = 0;
    let reply = '';

    for (; steps < MAX_STEPS; steps++) {
      const messages = [
        { role: 'system', content: `${AGENT_SYSTEM_PROMPT}\n\n可用工具：\n${buildToolPrompt()}` },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        ...turnMessages,
      ];

      const { content } = await chatCompletion({ messages, maxTokens: 4096 });

      const contentText = (content || '').trim();
      if (!contentText) {
        throw new Error('LLM 返回空内容，请重试');
      }

      const toolCall = tryParseToolCall(contentText);
      if (!toolCall?.tool) {
        // 最终回答
        reply = contentText;
        await appendAgentMessage(sessionId, 'assistant', reply);
        await touchAgentSession(sessionId);
        return { sessionId, reply, steps: steps + 1, toolLog, truncated: false };
      }

      const tool = getTool(toolCall.tool);
      if (!tool) {
        const feedback = `【工具不存在】工具 "${toolCall.tool}" 未注册。可用工具：${buildToolPrompt().split('\n').map((l) => l.split(':')[0]).join(', ')}。请重试。`;
        turnMessages.push({ role: 'user', content: feedback });
        await appendAgentMessage(sessionId, 'user', feedback);
        continue;
      }

      let resultText: string;
      let ok = true;
      try {
        resultText = await tool.execute(toolCall.args || {});
        if (resultText.length > TOOL_RESULT_MAX_CHARS) {
          resultText = resultText.slice(0, TOOL_RESULT_MAX_CHARS) + '\n…(结果过长已截断)';
        }
      } catch (err) {
        ok = false;
        resultText = `工具执行失败: ${(err as Error).message}`;
      }
      toolLog.push({
        name: tool.name,
        args: toolCall.args || {},
        ok,
        summary: resultText.split('\n')[0].slice(0, 100),
      });

      const meta = { toolCall: { name: tool.name, args: toolCall.args || {} } };
      // 持久化模型的真实输出（JSON 工具调用），而非占位符——跨轮次重放时模型
      // 仍能看到自己此前的调用内容（模型可见即记录）
      await appendAgentMessage(sessionId, 'assistant', contentText, meta);
      await appendAgentMessage(sessionId, 'user', `【工具 ${tool.name} 结果】\n${resultText}`, { toolResult: { name: tool.name, ok, content: resultText.slice(0, 200) } });

      turnMessages.push({ role: 'assistant', content: contentText });
      turnMessages.push({ role: 'user', content: `【工具 ${tool.name} 结果】\n${resultText}` });
    }

    // 步数上限：回退为回答当前已知内容
    reply = `已达到单轮工具调用上限（${MAX_STEPS} 步），以下是目前掌握的信息。如需继续深入，请追问。`;
    await appendAgentMessage(sessionId, 'assistant', reply);
    await touchAgentSession(sessionId);
    return { sessionId, reply, steps, toolLog, truncated: true };
  } catch (err) {
    // 错误时携带已创建的 sessionId：客户端失败重试可续用同一会话，避免孤儿会话
    if (sessionId != null) (err as Error & { sessionId?: number }).sessionId = sessionId;
    throw err;
  }
}
