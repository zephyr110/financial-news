import { BarChart3, AlertTriangle, TrendingUp, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const STAT_DEFS = [
  { key: 'total_signals', icon: Activity, label: '全部信号', filter: null },
  { key: 'significant_count', icon: TrendingUp, label: '重要信号', filter: 'significant', highlight: true },
  { key: 'max_score', icon: BarChart3, label: '最高分', filter: 'max' },
  { key: 'critical_count', icon: AlertTriangle, label: '预警', filter: 'critical', warn: true },
];

/**
 * Overview stat cards with click-to-filter support.
 * @param {Object} stats - { total_signals, significant_count, max_score, critical_count }
 * @param {string|null} filter - currently active filter
 * @param {Function} onFilterChange - callback(filterKey)
 */
export default function AnalysisOverview({ stats, loading, filter, onFilterChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {STAT_DEFS.map(({ key, icon: Icon, label, filter: fKey, highlight, warn }) => (
        <StatBox
          key={key}
          icon={<Icon className="h-4 w-4" />}
          label={label}
          value={loading ? null : (stats?.[key] ?? 0)}
          loading={loading}
          highlight={highlight}
          warn={warn}
          active={filter === fKey}
          onClick={() => onFilterChange?.(filter === fKey ? null : fKey)}
        />
      ))}
    </div>
  );
}

function StatBox({ icon, label, value, highlight, warn, loading, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "bg-card border rounded-lg p-3 text-center transition-all duration-150 w-full",
        active
          ? "border-primary ring-1 ring-primary/30 shadow-sm"
          : "hover:border-primary/50 hover:shadow-sm cursor-pointer"
      )}
    >
      <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
        {icon}
      </div>
      {loading ? (
        <div className="flex justify-center">
          <div className="h-7 w-12 rounded bg-muted animate-pulse" />
        </div>
      ) : (
        <div className={cn(
          "text-xl sm:text-2xl font-bold tabular-nums",
          warn ? 'text-red-600 dark:text-red-400' :
          highlight ? 'text-primary' : 'text-foreground'
        )}>
          {value ?? 0}
        </div>
      )}
      <div className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">{label}</div>
    </button>
  );
}
