import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, BellOff, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "signal-alert-enabled";

/**
 * 重要信号浏览器通知。
 *
 * 浏览器要求通知权限只能由用户手势（点击/按键）触发请求，
 * 因此不在挂载时自动 requestPermission，而是提供开关按钮，
 * 用户点击后才请求权限（手势满足后首次请求成功率最高）。
 *
 * items 由调用方传入（分析页为 watchedItems，天然按关注行业定向）。
 */
export default function SignalAlert({ items }: { items: any[] }) {
  const [enabled, setEnabled] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const lastNotifiedRef = useRef(0);

  // 初始状态：读取本地开关 + 当前权限
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setPermission(Notification.permission);
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setEnabled(true);
    } catch {
      // localStorage 不可用则默认关闭
    }
  }, []);

  // 开关为开且权限已授予时，监测新预警信号（每个 id 只提醒一次）
  useEffect(() => {
    if (!enabled || permission !== "granted") return;
    if (!items || items.length === 0) return;

    const critical = items.filter((i) => i.signal_score >= 4);
    if (critical.length === 0) return;

    const latestId = critical[0]?.id || 0;
    if (latestId <= lastNotifiedRef.current) return;
    lastNotifiedRef.current = latestId;

    showNotification(critical);
  }, [items, enabled, permission]);

  const handleToggle = useCallback(() => {
    if (permission === "unsupported") return;
    if (permission === "denied") {
      // 已被浏览器阻止：引导用户在站点设置中开启
      return;
    }
    if (!enabled) {
      // 用户手势内请求权限（浏览器要求）
      if (permission === "default" || permission === "granted") {
        Notification.requestPermission().then((perm) => {
          setPermission(perm);
          if (perm === "granted") {
            setEnabled(true);
            try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
          }
        });
      }
    } else {
      setEnabled(false);
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
  }, [enabled, permission]);

  if (permission === "unsupported") return null;

  const denied = permission === "denied";
  const active = enabled && permission === "granted";

  return (
    <div className="mx-auto max-w-[720px] lg:max-w-[960px] xl:max-w-[1200px] px-4 sm:px-6">
      {denied ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-[11px] sm:text-xs text-destructive mb-1">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          浏览器已阻止通知权限，请在站点设置中允许后重试
        </div>
      ) : (
        <button
          type="button"
          onClick={handleToggle}
          aria-pressed={active}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] sm:text-xs font-medium transition-colors mb-1",
            active
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40"
          )}
        >
          {active ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
          {active ? "重要信号提醒已开启" : "开启重要信号提醒"}
        </button>
      )}
    </div>
  );
}

function showNotification(critical: any[]) {
  const top = critical.slice(0, 3);
  const body = top.map((i) => `[${i.signal_score}分] ${i.summary}`).join("\n");
  try {
    new Notification(`财经信号 · ${critical.length} 条重要预警`, {
      body,
      icon: "/favicon.svg",
      tag: "financial-signals-alert",
    });
  } catch {
    // 浏览器可能阻止构造
  }
}
