import type { LucideIcon } from "lucide-react";
import { Loader2, Newspaper, RefreshCw } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  description?: string;
  hint?: string;
  icon?: LucideIcon;
  onRefresh?: () => void;
  refreshing?: boolean;
  className?: string;
}

export default function EmptyState({
  title = "暂无快讯数据",
  description = "正在从多个财经源采集最新快讯，识别高价值信号后将自动展示",
  hint = "每 5 分钟自动更新",
  icon: Icon = Newspaper,
  onRefresh,
  refreshing = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/30 px-6 py-14 sm:py-16 text-center",
        className
      )}
    >
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="h-6 w-6" aria-hidden />
      </span>

      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>

      {refreshing ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          正在加载最新快讯…
        </p>
      ) : (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          {hint}
        </p>
      )}

      {onRefresh && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          className="mt-6"
        >
          {refreshing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {refreshing ? "加载中…" : "立即刷新"}
        </Button>
      )}
    </div>
  );
}
