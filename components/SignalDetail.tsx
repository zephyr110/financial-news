import Link from "next/link";
import { TrendingUp, AlertCircle, Zap, ExternalLink } from "lucide-react";
import SignalBadge from "./SignalBadge";
import IndustryBacktestInline from "./IndustryBacktestInline";
import RelatedSignals from "./RelatedSignals";
import {
  CATEGORY_LABELS,
  CATEGORY_COLORS,
} from "@/lib/constants";

const STAGE_LABELS: Record<string, string> = {
  early: "早期",
  brewing: "发酵中",
  spreading: "全面扩散",
  priced_in: "成熟定价",
};

const STAGE_COLORS: Record<string, string> = {
  early: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  brewing: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  spreading: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  priced_in: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const SENTIMENT_LABELS: Record<string, string> = {
  positive: "利好",
  negative: "利空",
  neutral: "中性",
  mixed: "混合",
};

const IMPACT_LABELS: Record<string, string> = {
  critical: "重大",
  significant: "重要",
  moderate: "关注",
  minor: "一般",
  noise: "噪声",
};

interface SignalDetailSignal {
  signal_score: number;
  category: string;
  impact_level: string;
  sentiment: string;
  summary: string;
  deep_analysis: string | null;
  industries: string[];
  companies: string[];
  tags: string[];
  analyzed_at: string;
  source: string;
  content: string;
  published_at: string;
  event_thread: {
    id: number;
    title: string;
    stage: string;
    confidence: string;
  } | null;
}

interface BacktestRow {
  industry: string;
  samples: number;
  avg_d1: number;
  avg_d3: number;
  avg_d7: number;
  win_rate: number;
}

interface RelatedSignal {
  id: number;
  signal_score: number;
  category: string;
  industries: string[];
  summary: string;
  published_at: string;
}

interface SignalDetailProps {
  signal: SignalDetailSignal | null;
  related: RelatedSignal[];
  backtest: BacktestRow[];
}

/**
 * Full signal detail layout — composed of 6 sections:
 * Header → Deep Analysis → Industry Backtest → Related Signals → Event Thread → Original News
 */
export default function SignalDetail({
  signal,
  related,
  backtest,
}: SignalDetailProps) {
  if (!signal) return null;

  const categoryLabel = CATEGORY_LABELS[signal.category] || signal.category;
  const impactLabel = IMPACT_LABELS[signal.impact_level] || signal.impact_level;
  const sentimentLabel =
    SENTIMENT_LABELS[signal.sentiment] || signal.sentiment;

  // "利好" or "利空" based on sentiment
  const sentimentBadge =
    signal.sentiment === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : signal.sentiment === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-muted-foreground";

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="bg-card border rounded-xl p-4 sm:p-6">
        <div className="flex items-start gap-3 mb-3">
          <SignalBadge score={signal.signal_score} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-lg font-semibold text-foreground leading-snug">
              {signal.summary}
            </h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className={`text-[11px] sm:text-xs px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[signal.category] || "bg-gray-100 text-gray-700"}`}
              >
                {categoryLabel}
              </span>
              <span
                className={`text-[11px] sm:text-xs font-medium ${sentimentBadge}`}
              >
                {sentimentLabel}
              </span>
              <span className="text-[11px] text-muted-foreground">
                · {impactLabel}信号
              </span>
              <span className="text-[11px] text-muted-foreground">
                · {formatDate(signal.published_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Industries & Companies */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {signal.industries?.map((ind: string) => (
            <span
              key={ind}
              className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium"
            >
              {ind}
            </span>
          ))}
          {signal.companies?.map((comp: string) => (
            <span
              key={comp}
              className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full border text-muted-foreground"
            >
              {comp}
            </span>
          ))}
        </div>

        {/* Inline backtest */}
        {(signal.industries?.length > 0) && (
          <IndustryBacktestInline
            industries={signal.industries}
            backtestData={backtest}
          />
        )}
      </div>

      {/* ── Deep Analysis ── */}
      <div className="bg-card border rounded-xl p-4 sm:p-6">
        <h3 className="text-xs sm:text-sm font-medium text-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-primary" />
          深度分析
        </h3>
        {signal.deep_analysis ? (
          <p className="text-[13px] sm:text-sm text-foreground leading-relaxed whitespace-pre-line">
            {signal.deep_analysis}
          </p>
        ) : (
          <p className="text-[11px] sm:text-xs text-muted-foreground italic">
            深度分析生成中，请稍后刷新页面…
          </p>
        )}
      </div>

      {/* ── Industry Backtest ── */}
      {backtest && backtest.length > 0 && (
        <div className="bg-card border rounded-xl p-4 sm:p-6">
          <h3 className="text-xs sm:text-sm font-medium text-foreground mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-primary" />
            行业回测
          </h3>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground mb-3">
            信号出现后行业指数平均涨跌幅 · 过去 90 天
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] sm:text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-2 pr-4 font-medium">行业</th>
                  <th className="text-right py-2 px-2 font-medium">样本</th>
                  <th className="text-right py-2 px-2 font-medium">T+1</th>
                  <th className="text-right py-2 px-2 font-medium">T+3</th>
                  <th className="text-right py-2 px-2 font-medium">T+7</th>
                  <th className="text-right py-2 pl-2 font-medium">胜率</th>
                </tr>
              </thead>
              <tbody>
                {backtest.map((row: any) => (
                  <tr key={row.industry} className="border-b last:border-0 hover:bg-accent/20 transition-colors">
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {row.industry}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      {row.samples}
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      <ReturnSpan value={row.avg_d1} />
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      <ReturnSpan value={row.avg_d3} />
                    </td>
                    <td className="py-2 px-2 text-right tabular-nums">
                      <ReturnSpan value={row.avg_d7} />
                    </td>
                    <td className="py-2 pl-2 text-right tabular-nums font-medium">
                      {row.win_rate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Related Signals ── */}
      <RelatedSignals items={related} />

      {/* ── Event Thread Context ── */}
      {signal.event_thread && (
        <div className="bg-card border rounded-xl p-4 sm:p-6">
          <h3 className="text-xs sm:text-sm font-medium text-foreground mb-3 flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 text-primary" />
            所属事件线索
          </h3>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-[13px] sm:text-sm font-medium text-foreground">
              {signal.event_thread.title}
            </span>
            <span
              className={`text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                STAGE_COLORS[signal.event_thread.stage] || STAGE_COLORS.early
              }`}
            >
              {STAGE_LABELS[signal.event_thread.stage] || signal.event_thread.stage}
            </span>
            {signal.event_thread.confidence === "high" && (
              <Zap className="h-3.5 w-3.5 text-amber-500" />
            )}
          </div>
          <div className="mt-3">
            <Link
              href={`/thread/${signal.event_thread.id}`}
              className="text-[11px] sm:text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              查看完整线索 <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      {/* ── Original News ── */}
      <div className="bg-card border rounded-xl p-4 sm:p-6">
        <h3 className="text-xs sm:text-sm font-medium text-foreground mb-3">
          原始快讯
        </h3>
        <p className="text-[11px] sm:text-xs text-muted-foreground mb-2">
          来源：{signal.source || "未知"} · {formatDate(signal.published_at)}
        </p>
        <div className="text-[13px] sm:text-sm text-foreground leading-relaxed bg-accent/30 rounded-lg p-3">
          {signal.content || "原始快讯暂不可用"}
        </div>
      </div>
    </div>
  );
}

function ReturnSpan({ value }: { value: number | null }) {
  if (value == null || Number.isNaN(value))
    return <span className="text-muted-foreground">—</span>;
  // A股惯例：红涨绿跌
  const cls =
    value > 0
      ? "text-red-600 dark:text-red-400"
      : value < 0
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-muted-foreground";
  return (
    <span className={cls}>
      {value > 0 ? "+" : ""}
      {value.toFixed(2)}%
    </span>
  );
}

function formatDate(isoString: string): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
