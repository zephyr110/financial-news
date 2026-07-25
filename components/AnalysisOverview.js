import { AlertTriangle, TrendingUp, Zap, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Card definitions with distinct gradient backgrounds ---

const CARDS = [
  {
    key: null,
    icon: Zap,
    label: "信号强度",
    gradient: "from-blue-600 to-blue-500 dark:from-blue-700 dark:to-blue-600",
    textColor: "text-white",
    mutedColor: "text-blue-100/80",
    ringColor: "ring-blue-400/40",
  },
  {
    key: "critical",
    icon: AlertTriangle,
    label: "预警信号",
    gradient: "from-rose-600 to-rose-500 dark:from-rose-700 dark:to-rose-600",
    textColor: "text-white",
    mutedColor: "text-rose-100/80",
    ringColor: "ring-rose-400/40",
  },
  {
    key: "significant",
    icon: TrendingUp,
    label: "重要信号",
    gradient: "from-amber-500 to-amber-400 dark:from-amber-600 dark:to-amber-500",
    textColor: "text-white",
    mutedColor: "text-amber-100/80",
    ringColor: "ring-amber-400/40",
  },
  {
    key: "max",
    icon: BarChart3,
    label: "最高分",
    gradient: "from-emerald-600 to-emerald-500 dark:from-emerald-700 dark:to-emerald-600",
    textColor: "text-white",
    mutedColor: "text-emerald-100/80",
    ringColor: "ring-emerald-400/40",
  },
];

export default function AnalysisOverview({ stats, items, loading, filter, onFilterChange }) {
  const total = stats?.total_signals ?? 0;
  const avgScore = total > 0 && items?.length
    ? (items.reduce((s, i) => s + i.signal_score, 0) / items.length).toFixed(1)
    : "—";

  const values = {
    null: { value: avgScore, sub: `共 ${total} 条信号` },
    critical: { value: stats?.critical_count ?? 0, sub: "需立即关注" },
    significant: { value: stats?.significant_count ?? 0, sub: "含重要变化" },
    max: { value: stats?.max_score ?? 0, sub: "今日峰值" },
  };

  return (
    <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3 mb-6">
      {CARDS.map(({ key, icon: Icon, label, gradient, textColor, mutedColor, ringColor }, idx) => {
        const active = filter === key;
        const { value, sub } = values[key];

        return (
          <button
            key={label}
            type="button"
            onClick={() => onFilterChange?.(active ? null : key)}
            className={cn(
              "relative overflow-hidden rounded-xl p-3 sm:p-4 text-left transition-all duration-200",
              "bg-gradient-to-br", gradient,
              idx === 0 ? "sm:flex-[1.3]" : "sm:flex-1",
              active
                ? `ring-2 ring-offset-1 ring-offset-background ${ringColor} scale-[1.02]`
                : "hover:shadow-lg hover:scale-[1.01]"
            )}
          >
            {/* Decorative circle behind icon */}
            <div className={cn(
              "absolute -top-3 -right-3 w-16 h-16 rounded-full opacity-15",
              "bg-white dark:bg-white"
            )} />

            {/* Row 1: Icon + Label */}
            <div className="relative flex items-center gap-1.5 mb-2">
              <Icon className={cn("h-3.5 w-3.5", mutedColor)} />
              <span className={cn("text-[11px] sm:text-xs font-medium", mutedColor)}>
                {label}
              </span>
            </div>

            {/* Row 2: Big number */}
            {loading ? (
              <div className="relative">
                <div className="h-7 w-14 rounded bg-white/20 animate-pulse" />
              </div>
            ) : (
              <div className={cn(
                "relative text-2xl sm:text-3xl font-bold tabular-nums tracking-tight mb-0.5",
                textColor
              )}>
                {value}
              </div>
            )}

            {/* Row 3: Subtitle */}
            <div className={cn(
              "relative text-[10px] sm:text-[11px] font-normal opacity-80",
              mutedColor
            )}>
              {sub}
            </div>
          </button>
        );
      })}
    </div>
  );
}
