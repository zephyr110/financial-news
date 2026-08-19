import { useState, useEffect, useRef, useCallback } from "react";
import Head from "next/head";
import { MessageSquareText, Send, RotateCcw, Wrench, AlertCircle, Loader2 } from "lucide-react";
import SiteHeader from "../components/SiteHeader";

interface ToolCallInfo {
  name: string;
  args: Record<string, unknown>;
}

interface ChatItem {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCall?: ToolCallInfo;
  toolLog?: { name: string; args: Record<string, unknown>; ok: boolean; summary: string }[];
}

const SESSION_STORAGE_KEY = "agent-session-id";

export default function AgentPage() {
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // 刷新后恢复上次会话：服务端保留完整上下文，续聊不另起孤儿会话
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved && /^\d+$/.test(saved)) setSessionId(Number(saved));
    } catch {
      // localStorage 不可用（隐私模式等）时静默降级
    }
  }, []);

  const persistSession = useCallback((id: number | null) => {
    try {
      if (id == null) localStorage.removeItem(SESSION_STORAGE_KEY);
      else localStorage.setItem(SESSION_STORAGE_KEY, String(id));
    } catch {
      // 静默降级
    }
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    setLoading(true);

    // 乐观渲染用户消息（id 在闭包内固定，失败时按同一 id 移除）
    const optimisticId = `local-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, role: "user", content: text }]);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionId ?? undefined, message: text, stream: true }),
      });

      // 非流式失败响应（400/503/500）→ 与旧逻辑一致处理
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        // 服务端错误会携带已创建的 sessionId：保留它，失败重试续用同一会话而非创建孤儿会话
        if (data.sessionId) {
          setSessionId(data.sessionId);
          persistSession(data.sessionId);
        }
        if (res.status === 503) {
          setError("研究助手未配置：请设置 LLM_API_KEY 环境变量（或 DEEPSEEK_API_KEY）。");
        } else {
          setError(data.error || `请求失败（HTTP ${res.status}）`);
        }
        // 移除乐观渲染的 user 消息，让用户重试
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        return;
      }

      // ── SSE 流式读取：tool_start → delta… → done ──
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamMsgId: string | null = null;
      let streamText = "";
      let toolLogs: ChatItem["toolLog"] = [];
      let doneSessionId: number | null = null;

      const handleEvent = (event: string, payload: any) => {
        if (event === "tool_start") {
          // 工具调用 JSON 的 delta 已累积在流式消息中 → 移除并替换为工具气泡
          if (streamMsgId) {
            setMessages((prev) => prev.filter((m) => m.id !== streamMsgId));
            streamMsgId = null;
            streamText = "";
          }
          setMessages((prev) => [
            ...prev,
            {
              id: `tool-${Date.now()}-${payload.tool}`,
              role: "assistant" as const,
              content: "",
              toolCall: { name: payload.tool, args: payload.args || {} } as ToolCallInfo,
            },
          ]);
        } else if (event === "delta") {
          streamText += payload.text || "";
          if (!streamMsgId) {
            streamMsgId = `stream-${Date.now()}`;
            setMessages((prev) => [...prev, { id: streamMsgId!, role: "assistant", content: "" }]);
          }
          setMessages((prev) =>
            prev.map((m) => (m.id === streamMsgId ? { ...m, content: streamText } : m))
          );
        } else if (event === "done") {
          doneSessionId = payload.sessionId;
          toolLogs = payload.toolLog || [];
          const reply = streamText || payload.reply || "";
          // 工具日志附加到最终回复气泡（若无 delta 累积则新建消息）
          setMessages((prev) =>
            streamMsgId
              ? prev.map((m) => (m.id === streamMsgId ? { ...m, toolLog: toolLogs } : m))
              : [...prev, { id: `reply-${Date.now()}`, role: "assistant" as const, content: reply, toolLog: toolLogs }]
          );
        } else if (event === "error") {
          setError(payload.error || "研究助手暂时不可用，请稍后再试");
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";
        for (const block of blocks) {
          let evt = "";
          let data = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) evt = line.slice(6).trim();
            else if (line.startsWith("data:")) data = line.slice(5).trim();
          }
          if (!evt || !data) continue;
          try {
            handleEvent(evt, JSON.parse(data));
          } catch {
            // 忽略无法解析的事件块
          }
        }
      }

      if (doneSessionId) {
        setSessionId(doneSessionId);
        persistSession(doneSessionId);
      } else if (streamMsgId) {
        // 流中断（超时/网络断开）但已有内容：保留已显示的部分
        setMessages((prev) =>
          prev.map((m) => (m.id === streamMsgId ? { ...m, toolLog: toolLogs } : m))
        );
      }
    } catch (e) {
      console.error("Agent request failed:", e);
      setError("网络错误，请稍后重试");
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, sessionId, persistSession]);

  const newSession = useCallback(() => {
    setSessionId(null);
    persistSession(null);
    setMessages([]);
    setError(null);
    inputRef.current?.focus();
  }, [persistSession]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send]
  );

  return (
    <>
      <Head>
        <title>研究助手 — 财经信号</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="AI 研究助手 — 政策、行业、事件线索问答" />
      </Head>

      <SiteHeader />

      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-[720px] px-4 sm:px-6 pb-12">
          <div className="pt-8 pb-4 flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-[13px] sm:text-sm text-muted-foreground font-normal">
              基于真实信号数据的问答 — 政策 · 行业 · 事件线索
            </h2>
            <button
              type="button"
              onClick={newSession}
              className="inline-flex items-center gap-1.5 px-2.5 h-8 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> 新会话
            </button>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 对话区 */}
          <div className="rounded-xl border bg-card">
            <div className="p-4 sm:p-6 min-h-[420px] max-h-[60vh] overflow-y-auto space-y-4">
              {messages.length === 0 && !loading && (
                <div className="text-center py-12 text-sm text-muted-foreground space-y-2">
                  <MessageSquareText className="h-8 w-8 mx-auto opacity-40" />
                  <p>试试问：</p>
                  <p className="text-xs space-y-1">
                    「存储涨价链条现在到哪个阶段了？」<br />
                    「今天有哪些政策信号？」<br />
                    「半导体行业近一周信号强度如何？」
                  </p>
                </div>
              )}

              {messages.map((m) => {
                if (m.role === "system") {
                  return (
                    <div key={m.id} className="text-center text-xs text-muted-foreground/70 py-1">
                      {m.content}
                    </div>
                  );
                }
                if (m.toolCall) {
                  return (
                    <div key={m.id} className="flex justify-start">
                      <div className="max-w-[85%] inline-flex items-center gap-1.5 rounded-lg border bg-accent/60 px-3 py-1.5 text-xs text-muted-foreground">
                        <Wrench className="h-3 w-3" />
                        调用工具 {m.toolCall.name}
                      </div>
                    </div>
                  );
                }
                const isUser = m.role === "user";
                return (
                  <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                        isUser
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent/70 text-foreground"
                      }`}
                    >
                      {m.content}
                      {m.toolLog && m.toolLog.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-foreground/10 space-y-1">
                          {m.toolLog.map((t, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs opacity-80">
                              <Wrench className="h-3 w-3 shrink-0" />
                              <span className="truncate">{t.name}</span>
                              <span className="truncate text-muted-foreground">{t.summary}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex justify-start">
                  <div className="inline-flex items-center gap-2 rounded-xl bg-accent/70 px-3.5 py-2.5 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在研究…
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* 输入区 */}
            <div className="border-t p-3 sm:p-4">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="询问政策影响、行业趋势、事件进展…（Enter 发送，Shift+Enter 换行）"
                  rows={1}
                  maxLength={2000}
                  className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[42px] max-h-[160px]"
                />
                <button
                  type="button"
                  onClick={send}
                  disabled={loading || !input.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40 transition-opacity"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">发送</span>
                </button>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground/70">
                AI 输出基于历史信号数据整理，仅供参考，不构成投资建议
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
