import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface BacktestIndustryRow {
  industry: string;
  samples: number;
  avg_d1: number;
  avg_d3: number;
  avg_d7: number;
  win_rate: number;
}

interface IndustryBacktestInlineProps {
  industries: string[];
  backtestData: BacktestIndustryRow[];
  onViewDetail?: (industry: string) => void;
  className?: string;
}

/**
 * Inline backtest summary shown on signal cards.
 * Displays the best-matching industry's backtest stats on one line.
 *
 * Used by: AnalysisNewsCard (F7), SignalDetail page (F2)
 */
export default function IndustryBacktestInline({
  industries,
  backtestData,
  onViewDetail,
  className,
}: IndustryBacktestInlineProps) {
  if (!industries || industries.length === 0) return null;
  if (!backtestData || backtestData.length === 0) return null;

  // Find the best match: exact match first, then fuzzy
  let match: BacktestIndustryRow | undefined;
  for (const ind of industries) {
    match = backtestData.find(
      (b) => b.industry === ind || b.industry.includes(ind) || ind.includes(b.industry)
    );
    if (match) break;
  }

  if (!match) return null;

  const d1 = match.avg_d1;
  const isPositive = d1 > 0;
  const isNegative = d1 < 0;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-[10px] sm:text-[11px] text-muted-foreground mt-1.5 pt-1.5 border-t border-border/50",
        onViewDetail && "cursor-pointer hover:text-foreground transition-colors",
        className
      )}
      onClick={() => onViewDetail?.(match!.industry)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onViewDetail?.(match!.industry);
        }
      }}
      role={onViewDetail ? "button" : undefined}
      tabIndex={onViewDetail ? 0 : undefined}
      title={`${match.industry} · 近90天回测 · ${match.samples} 个样本`}
    >
      <span className="font-medium">📊 {match.industry}</span>
      <span>·</span>
      <span>胜率 {match.win_rate}%</span>
      <span>·</span>
      <span className="inline-flex items-center gap-0.5">
        T+3
        {isPositive ? (
          <TrendingUp className="h-3 w-3 text-emerald-500" />
        ) : isNegative ? (
          <TrendingDown className="h-3 w-3 text-red-500" />
        ) : (
          <Minus className="h-3 w-3" />
        )}
        <span
          className={cn(
            "font-medium",
            isPositive && "text-emerald-600 dark:text-emerald-400",
            isNegative && "text-red-600 dark:text-red-400"
          )}
        >
          {d1 > 0 ? "+" : ""}{d1.toFixed(2)}%
        </span>
      </span>
    </div>
  );
}
