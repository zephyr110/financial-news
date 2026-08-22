"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** 递归提取代码块纯文本（供复制按钮用）。 */
function extractText(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText(node.props.children);
  }
  return "";
}

/**
 * agent 回复中的代码块（参考 zlog CodeBlock，适配聊天气泡尺寸与语义色板）：
 * 圆角边框容器 + 顶栏（语言标签 + 复制按钮）+ 可横向滚动内容区。
 * 全部使用语义色变量，深浅主题自适应。
 */
export default function AgentCodeBlock({ lang, children }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const text = extractText(children).trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 剪贴板不可用（非安全上下文）时静默
    }
  };

  return (
    <div className="my-2 overflow-hidden rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between border-b px-2.5 py-1.5">
        {lang ? (
          <span className="truncate font-mono text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
            {lang}
          </span>
        ) : (
          <span className="font-mono text-[10px] text-muted-foreground">code</span>
        )}
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex h-5 shrink-0 items-center gap-1 rounded px-1.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="复制代码"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-500" />
              已复制
            </>
          ) : (
            <>
              <Copy className="size-3" />
              复制
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-2.5 text-xs leading-relaxed">{children}</pre>
    </div>
  );
}
