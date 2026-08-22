import { useState, useEffect } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { isWatched, toggleWatchlist, subscribeWatchlist, type WatchlistType } from "@/lib/watchlist";

interface Props {
  type: WatchlistType;
  id: string | number;
  className?: string;
  /** 紧凑模式：只显示图标（详情页头部/卡片） */
  compact?: boolean;
}

/**
 * P2.2 跟踪按钮：切换 watchlist 状态。
 * 状态跨组件同步（subscribeWatchlist），刷新后保持（localStorage）。
 */
export default function WatchlistButton({ type, id, className, compact = false }: Props) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(isWatched(type, String(id)));
    return subscribeWatchlist(() => setOn(isWatched(type, String(id))));
  }, [type, id]);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "取消跟踪" : "跟踪"}
      onClick={() => toggleWatchlist(type, String(id))}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border transition-colors",
        on
          ? "border-amber-400/60 bg-amber-400/10 text-amber-500 hover:bg-amber-400/20"
          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
        compact ? "px-1.5 py-1" : "px-2.5 py-1 text-xs font-medium",
        className,
      )}
    >
      <Star className={cn("h-3.5 w-3.5", on && "fill-amber-400")} />
      {!compact && (on ? "已跟踪" : "跟踪")}
    </button>
  );
}
