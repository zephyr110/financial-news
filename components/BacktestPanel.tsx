import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, Loader2, ChevronDown, Building2, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBacktestTier, shouldShowNumbers, tierProgress, type BacktestTier } from "@/lib/backtest";

interface BacktestRow {
  signal_score?: number;
  industry?: string;
  samples: number;
  avg_d1: number;
  avg_d3: number;
  avg_d7: number;
  win_rate: number;
}

type TabKey = "score" | "industry";

// 表格网格列模板：1fr 行业 | 48px 分数 | 88px 样本 | 3×涨跌幅 | 80px 胜率（表头与两种行共用，改列宽需同步）
const HEADER_GRID = "hidden sm:grid grid-cols-[1fr_48px_88px_repeat(3,1fr)_80px]";
const ROW_GRID = "grid grid-cols-[1fr_48px_1fr] sm:grid-cols-[1fr_48px_88px_repeat(3,1fr)_80px]";

export default function BacktestPanel() {
  const [byScore, setByScore] = useState<BacktestRow[] | null>(null);
  const [byIndustry, setByIndustry] = useState<BacktestRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true); // default expanded
  const [tab, setTab] = useState<TabKey>("industry");

  useEffect(() => {
    if (!open && byIndustry === null) return;
    if (byIndustry !== null) return;
    let cancelled = false;
    setLoading(true);
    fetch("/api/backtest")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setByScore(d.byScore || []);
        setByIndustry(d.byIndustry || []);
      })
      .catch(() => {
        if (cancelled) return;
        setByScore([]);
        setByIndustry([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, byIndustry]);

  const activeData = tab === "score" ? byScore : byIndustry;
  const hasData = activeData && activeData.length > 0;

  return (
    <div className="bg-card border rounded-xl mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 sm:p-5 text-left hover:bg-accent/30 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            信号有效性回测
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            信号出现后行业指数后续涨跌幅 · 近 90 天 · 胜率 = T+1 上涨样本占比
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform shrink-0",
            open && "rotate-180"
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden min-h-0">
        <div className="px-4 sm:px-5 pb-4 sm:pb-5 border-t pt-3">
          {loading ? (
            <div className="flex min-h-28 items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs">加载中…</span>
            </div>
          ) : !hasData ? (
            <div className="text-center py-8 text-xs text-muted-foreground">
              暂无数据，信号和行情积累后自动生成
            </div>
          ) : (
            <>
              {/* Tab switcher */}
              <div className="flex items-center gap-1 mb-3">
                <button
                  type="button"
                  onClick={() => setTab("industry")}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 h-8 rounded-md text-xs transition-colors",
                    tab === "industry"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Building2 className="h-3 w-3" />
                  按行业
                </button>
                <button
                  type="button"
                  onClick={() => setTab("score")}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 h-8 rounded-md text-xs transition-colors",
                    tab === "score"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Hash className="h-3 w-3" />
                  按分数
                </button>
              </div>

              {/* Header */}
              <div className={cn(HEADER_GRID, "gap-2 mb-1 text-xs text-muted-foreground px-1")}>
                <span>{tab === "industry" ? "行业" : "分数"}</span>
                <span>{tab === "industry" ? "均分" : ""}</span>
                <span>样本</span>
                <span>T+1</span>
                <span>T+3</span>
                <span>T+7</span>
                <span>胜率</span>
              </div>

              {/* Industry view */}
              {tab === "industry" &&
                (byIndustry as BacktestRow[])
                  ?.sort((a, b) => b.samples - a.samples)
                  .slice(0, 15)
                  .map((row) => {
                    // P2.3 可信度分层：样本不足只显示行业名 + 进度（不展示数字，R4 只改展示不改数据）
                    const tier = getBacktestTier(row.samples);
                    const showNumbers = shouldShowNumbers(tier);
                    return (
                      <div
                        key={`${row.industry}-${row.signal_score}`}
                        className={cn(ROW_GRID, "gap-2 items-center py-2 px-1 border-t first:border-t-0 hover:bg-accent/20 rounded transition-colors")}
                      >
                        <span className="text-xs font-medium text-foreground truncate">
                          {row.industry}
                        </span>
                        <ScoreBadge score={row.signal_score} />
                        <SampleCell samples={row.samples} tier={tier} />
                        <div className="sm:hidden text-xs text-muted-foreground">
                          {showNumbers
                            ? `${tier === "reference" ? "~" : ""}样本 ${row.samples} · T+1 ${fmtPct(row.avg_d1, tier)} · T+3 ${fmtPct(row.avg_d3, tier)} · T+7 ${fmtPct(row.avg_d7, tier)}`
                            : tierProgress(row.samples)}
                        </div>
                        <ReturnCell value={row.avg_d1} show={showNumbers} tier={tier} />
                        <ReturnCell value={row.avg_d3} show={showNumbers} tier={tier} />
                        <ReturnCell value={row.avg_d7} show={showNumbers} tier={tier} />
                        <WinRateCell rate={row.win_rate} show={showNumbers} tier={tier} />
                      </div>
                    );
                  })}

              {/* Score view */}
              {tab === "score" &&
                (byScore as BacktestRow[])
                  ?.sort((a, b) => (b.signal_score ?? 0) - (a.signal_score ?? 0))
                  .map((row, i) => {
                    // 分数组同样受分层约束：样本不足不展示收益/胜率数字
                    const tier = getBacktestTier(row.samples);
                    const showNumbers = shouldShowNumbers(tier);
                    return (
                      <div
                        key={`score-${row.signal_score ?? "null"}-${i}`}
                        className={cn(ROW_GRID, "gap-2 items-center py-2 px-1 border-t first:border-t-0 hover:bg-accent/20 rounded transition-colors")}
                      >
                        <ScoreBadge score={row.signal_score} />
                        <span className="w-6" />
                        <SampleCell samples={row.samples} tier={tier} />
                        <div className="sm:hidden text-xs text-muted-foreground">
                          {showNumbers
                            ? `${tier === "reference" ? "~" : ""}样本 ${row.samples} · T+1 ${fmtPct(row.avg_d1, tier)} · T+3 ${fmtPct(row.avg_d3, tier)} · T+7 ${fmtPct(row.avg_d7, tier)}`
                            : tierProgress(row.samples)}
                        </div>
                        <ReturnCell value={row.avg_d1} show={showNumbers} tier={tier} />
                        <ReturnCell value={row.avg_d3} show={showNumbers} tier={tier} />
                        <ReturnCell value={row.avg_d7} show={showNumbers} tier={tier} />
                        <WinRateCell rate={row.win_rate} show={showNumbers} tier={tier} />
                      </div>
                    );
                  })}
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

/** 样本列：充足=绿徽章数字、参考=琥珀 ~数字（与行内 ~ 约定一致）、积累=灰进度。 */
function SampleCell({ samples, tier }: { samples: number; tier: BacktestTier }) {
  return (
    <span
      className={cn(
        "hidden sm:inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium tabular-nums",
        tier === "sufficient" &&
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
        tier === "reference" &&
          "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
        tier === "accumulating" && "bg-muted text-muted-foreground"
      )}
    >
      {tier === "accumulating" ? tierProgress(samples) : tier === "reference" ? `~${samples}` : samples}
    </span>
  );
}

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="w-6 h-6" />;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full text-xs font-bold shrink-0 w-6 h-6",
        score >= 5
          ? "bg-red-600 text-white"
          : score >= 4
            ? "bg-orange-500 text-white"
            : "bg-yellow-500 text-white"
      )}
    >
      {score}
    </span>
  );
}

function ReturnCell({ value, show = true, tier }: { value: number; show?: boolean; tier?: BacktestTier }) {
  if (!show || value == null)
    return (
      <span className="text-xs text-muted-foreground tabular-nums hidden sm:block">
        —
      </span>
    );
  const isPositive = value > 0;
  // A股惯例：红涨绿跌
  return (
    <span
      className={cn(
        "hidden sm:flex items-center gap-1 text-xs font-medium tabular-nums",
        isPositive
          ? "text-red-600 dark:text-red-400"
          : value < 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground"
      )}
    >
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : value < 0 ? (
        <TrendingDown className="h-3 w-3" />
      ) : null}
      {fmtPct(value, tier)}
    </span>
  );
}

function WinRateCell({ rate, show = true, tier }: { rate: number; show?: boolean; tier?: BacktestTier }) {
  return (
    <div className="hidden sm:flex items-center gap-1.5">
      <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", show ? "bg-primary" : "bg-border")}
          style={{ width: show ? `${rate}%` : "100%" }}
        />
      </div>
      <span className="text-xs font-medium tabular-nums w-9 text-right">
        {show ? `${tier === "reference" ? "~" : ""}${rate}%` : "—"}
      </span>
    </div>
  );
}

function fmtPct(v: number, tier?: BacktestTier): string {
  if (v == null || isNaN(v)) return "—";
  return `${tier === "reference" ? "~" : ""}${v > 0 ? "+" : ""}${v.toFixed(2)}%`;
}
