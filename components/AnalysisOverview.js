import { AlertTriangle, TrendingUp, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Analysis overview — 1 hero card + 3 compact stat cards.
 * Click to filter the signal timeline below.
 */
export default function AnalysisOverview({ stats, items, loading, filter, onFilterChange }) {
  const total = stats?.total_signals ?? 0;
  const avgScore = total > 0 && items?.length
    ? (items.reduce((s, i) => s + i.signal_score, 0) / items.length).toFixed(1)
    : "0.0";
  const critical = stats?.critical_count ?? 0;
  const significant = stats?.significant_count ?? 0;
  const maxScore = stats?.max_score ?? 0;

  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      {/* Hero card — average signal strength */}
      <button
        type="button"
        onClick={() => onFilterChange?.(null)}
        className={cn(
          "flex-1 bg-card border rounded-xl p-4 sm:p-5 text-left transition-all duration-150",
          !filter
            ? "border-primary ring-1 ring-primary/30 shadow-sm"
            : "hover:border-primary/50 hover:shadow-sm"
        )}
      >
        <div className="flex items-center gap-2 text-muted-foreground mb-2">
          <Zap className="h-4 w-4" />
          <span className="text-[11px] sm:text-xs font-medium">今日信号强度</span>
        </div>
        {loading ? (
          <div className="space-y-2">
            <div className="h-8 w-20 rounded bg-muted animate-pulse" />
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl sm:text-4xl font-bold tabular-nums text-foreground">
                {avgScore}
              </span>
              <span className="text-sm text-muted-foreground">/ 5</span>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">
              共 {total} 条信号新闻
            </p>
          </>
        )}
      </button>

      {/* Compact stat cards */}
      <div className="flex flex-row sm:flex-col gap-3 sm:w-[200px]">
        <MiniStat
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="预警"
          value={critical}
          warn
          active={filter === 'critical'}
          onClick={() => onFilterChange?.(filter === 'critical' ? null : 'critical')}
        />
        <MiniStat
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          label="重要信号"
          value={significant}
          highlight
          active={filter === 'significant'}
          onClick={() => onFilterChange?.(filter === 'significant' ? null : 'significant')}
        />
        <MiniStat
          icon={<span className="font-bold text-[10px]">{maxScore}</span>}
          label={`最高 ${maxScore} 分`}
          active={filter === 'max'}
          onClick={() => onFilterChange?.(filter === 'max' ? null : 'max')}
        />
      </div>
    </div>
  );
}

function MiniStat({ icon, label, value, warn, highlight, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 sm:flex-none flex sm:flex-col items-center sm:items-start gap-2 sm:gap-0.5 bg-card border rounded-lg px-3 py-2.5 sm:p-3 transition-all duration-150",
        active
          ? "border-primary ring-1 ring-primary/30 shadow-sm"
          : "hover:border-primary/50 hover:shadow-sm"
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
      </div>
      <div className={cn(
        "text-lg sm:text-xl font-bold tabular-nums",
        warn ? "text-red-600 dark:text-red-400" :
        highlight ? "text-primary" : "text-foreground"
      )}>
        {value ?? 0}
      </div>
      <div className="text-[11px] sm:text-xs text-muted-foreground">{label}</div>
    </button>
  );
}
