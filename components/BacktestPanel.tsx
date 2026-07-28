import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface BacktestRow {
  signal_score?: number;
  industry?: string;
  samples: number;
  avg_d1: number;
  avg_d3: number;
  avg_d7: number;
  win_rate: number;
}

export default function BacktestPanel() {
  const [byScore, setByScore] = useState<BacktestRow[] | null>(null);
  const [byIndustry, setByIndustry] = useState<BacktestRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open && byScore === null) return;
    if (byScore !== null) return;
    setLoading(true);
    fetch("/api/backtest")
      .then(r => r.json())
      .then(d => {
        setByScore(d.byScore || []);
        setByIndustry(d.byIndustry || []);
      })
      .catch(() => { setByScore([]); setByIndustry([]); })
      .finally(() => setLoading(false));
  }, [open, byScore]);

  const hasData = byScore && byScore.length > 0;

  return (
    <div className="bg-card border rounded-xl mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 sm:p-5 text-left hover:bg-accent/30 transition-colors"
      >
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
          open ? "max-h-[1200px] opacity-100" : "max-h-0 opacity-0"
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
              {/* Score-level summary */}
              <h4 className="text-[10px] sm:text-[11px] font-medium text-muted-foreground mb-2">按信号评分</h4>
              <div className="hidden sm:grid grid-cols-[64px_repeat(3,1fr)_80px] gap-2 mb-1 text-[10px] text-muted-foreground px-1">
                <span>评分</span>
                <span>T+1</span>
                <span>T+3</span>
                <span>T+7</span>
                <span>胜率</span>
              </div>

              {byScore!.sort((a, b) => (b.signal_score || 0) - (a.signal_score || 0)).map(row => (
                <div key={row.signal_score}
                  className="grid grid-cols-[48px_1fr] sm:grid-cols-[64px_repeat(3,1fr)_80px] gap-2 items-center py-2 px-1 border-t first:border-t-0 hover:bg-accent/20 rounded transition-colors">
                  <ScoreBadge score={row.signal_score!} />
                  <div className="sm:hidden flex flex-col gap-0.5">
                    <span className="text-[11px] text-muted-foreground">T+1 {fmtPct(row.avg_d1)} · T+3 {fmtPct(row.avg_d3)} · T+7 {fmtPct(row.avg_d7)}</span>
                    <span className="text-[10px] text-muted-foreground">胜率 {row.win_rate}% · 样本 {row.samples}</span>
                  </div>
                  <ReturnCell value={row.avg_d1} />
                  <ReturnCell value={row.avg_d3} />
                  <ReturnCell value={row.avg_d7} />
                  <WinRateCell rate={row.win_rate} />
                </div>
              ))}

              {/* Industry-level detail */}
              {byIndustry && byIndustry.length > 0 && (
                <>
                  <h4 className="text-[10px] sm:text-[11px] font-medium text-muted-foreground mt-4 mb-2">按行业（样本≥3）</h4>
                  <div className="hidden sm:grid grid-cols-[1fr_48px_repeat(3,1fr)_80px] gap-2 mb-1 text-[10px] text-muted-foreground px-1">
                    <span>行业</span>
                    <span>评分</span>
                    <span>T+1</span>
                    <span>T+3</span>
                    <span>胜率</span>
                  </div>
                  {byIndustry!.slice(0, 10).map((row, i) => (
                    <div key={`${row.industry}-${row.signal_score}`}
                      className="grid grid-cols-[1fr_48px_1fr] sm:grid-cols-[1fr_48px_repeat(3,1fr)_80px] gap-2 items-center py-2 px-1 border-t first:border-t-0 hover:bg-accent/20 rounded transition-colors">
                      <span className="text-[11px] sm:text-xs font-medium text-foreground truncate">{row.industry}</span>
                      <ScoreBadge score={row.signal_score!} small />
                      <div className="sm:hidden text-[11px] text-muted-foreground">T+1 {fmtPct(row.avg_d1)} · T+3 {fmtPct(row.avg_d3)}</div>
                      <ReturnCell value={row.avg_d1} />
                      <ReturnCell value={row.avg_d3} />
                      <WinRateCell rate={row.win_rate} />
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreBadge({ score, small }: { score: number; small?: boolean }) {
  return (
    <span className={cn(
      "inline-flex items-center justify-center rounded-full text-xs font-bold shrink-0",
      small ? "w-6 h-6 text-[10px]" : "w-8 h-8",
      score >= 5 ? "bg-red-600 text-white" :
      score >= 4 ? "bg-orange-500 text-white" :
      "bg-yellow-500 text-white"
    )}>{score}</span>
  );
}

function ReturnCell({ value }: { value: number }) {
  if (value == null) return <span className="text-[11px] text-muted-foreground tabular-nums hidden sm:block">—</span>;
  const isPositive = value > 0;
  return (
    <span className={cn(
      "hidden sm:flex items-center gap-1 text-[11px] sm:text-xs font-medium tabular-nums",
      isPositive ? "text-emerald-600 dark:text-emerald-400" :
      value < 0 ? "text-red-600 dark:text-red-400" :
      "text-muted-foreground"
    )}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : value < 0 ? <TrendingDown className="h-3 w-3" /> : null}
      {fmtPct(value)}
    </span>
  );
}

function WinRateCell({ rate }: { rate: number }) {
  return (
    <div className="hidden sm:flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${rate}%` }} />
      </div>
      <span className="text-[10px] sm:text-[11px] font-medium tabular-nums w-9 text-right">{rate}%</span>
    </div>
  );
}

function fmtPct(v: number): string {
  if (v == null || isNaN(v)) return "—";
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}
