import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, BarChart3, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface BacktestRow {
  signal_score: number;
  samples: number;
  avg_d1: number;
  avg_d3: number;
  avg_d7: number;
  win_rate: number;
}

export default function BacktestPanel() {
  const [data, setData] = useState<BacktestRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open && data === null) return; // only fetch on first open
    if (data !== null) return; // already loaded
    setLoading(true);
    fetch("/api/backtest")
      .then(r => r.json())
      .then(d => setData(d.summary || []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [open, data]);

  const hasData = data && data.length > 0;

  return (
    <div className="bg-card border rounded-xl mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 sm:p-5 text-left hover:bg-accent/30 transition-colors"
      >
        <BarChart3 className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <h3 className="text-xs sm:text-sm font-medium text-foreground">
            信号有效性回测
          </h3>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
            信号出现后行业指数平均涨跌幅 · 过去 90 天
          </p>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", open && "rotate-180")}
        />
      </button>

      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          open ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t pt-3">
          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-[11px] sm:text-xs">加载回测数据…</span>
            </div>
          ) : !hasData ? (
            <div className="text-center py-8 text-[11px] sm:text-xs text-muted-foreground">
              暂无回测数据，等待行情数据积累
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="hidden sm:grid grid-cols-[80px_repeat(4,1fr)] gap-3 mb-2 text-[10px] sm:text-[11px] text-muted-foreground px-1">
                <span />
                <span>T+1 日均涨跌</span>
                <span>T+3 累计涨跌</span>
                <span>T+7 累计涨跌</span>
                <span>胜率</span>
              </div>

              {data
                .sort((a, b) => b.signal_score - a.signal_score)
                .map((row) => (
                  <div
                    key={row.signal_score}
                    className="grid grid-cols-[48px_1fr] sm:grid-cols-[80px_repeat(4,1fr)] gap-3 items-center py-2.5 px-1 border-t first:border-t-0 hover:bg-accent/20 rounded transition-colors"
                  >
                    {/* Score badge */}
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shrink-0",
                        row.signal_score >= 5 ? "bg-red-600 text-white" :
                        row.signal_score >= 4 ? "bg-orange-500 text-white" :
                        "bg-yellow-500 text-white"
                      )}
                    >
                      {row.signal_score}
                    </span>

                    {/* Mobile combined row */}
                    <div className="sm:hidden flex flex-col gap-0.5">
                      <span className="text-[11px] text-muted-foreground">
                        T+1 {fmtPct(row.avg_d1)} · T+3 {fmtPct(row.avg_d3)} · T+7 {fmtPct(row.avg_d7)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        胜率 {row.win_rate}% · 样本 {row.samples}
                      </span>
                    </div>

                    {/* Desktop columns */}
                    <ReturnCell value={row.avg_d1} />
                    <ReturnCell value={row.avg_d3} />
                    <ReturnCell value={row.avg_d7} />
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${row.win_rate}%` }}
                        />
                      </div>
                      <span className="text-[11px] sm:text-xs font-medium tabular-nums w-10 text-right">
                        {row.win_rate}%
                      </span>
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReturnCell({ value }: { value: number }) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  if (value == null) return <span className="text-[11px] text-muted-foreground tabular-nums">—</span>;
  return (
    <div className="hidden sm:flex items-center gap-1">
      {isPositive ? (
        <TrendingUp className="h-3 w-3 text-emerald-500" />
      ) : isNegative ? (
        <TrendingDown className="h-3 w-3 text-red-500" />
      ) : (
        <span className="w-3" />
      )}
      <span
        className={cn(
          "text-[11px] sm:text-xs font-medium tabular-nums",
          isPositive ? "text-emerald-600 dark:text-emerald-400" :
          isNegative ? "text-red-600 dark:text-red-400" :
          "text-muted-foreground"
        )}
      >
        {fmtPct(value)}
      </span>
    </div>
  );
}

function fmtPct(v: number): string {
  if (v == null || isNaN(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}
