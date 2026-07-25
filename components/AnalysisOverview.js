import { BarChart3, AlertTriangle, TrendingUp, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const STAT_DEFS = [
  { key: 'total_signals', icon: Activity, label: '信号新闻' },
  { key: 'significant_count', icon: TrendingUp, label: '重要信号', highlight: true },
  { key: 'max_score', icon: BarChart3, label: '最高分' },
  { key: 'critical_count', icon: AlertTriangle, label: '预警', warn: true },
];

export default function AnalysisOverview({ stats, loading }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {STAT_DEFS.map(({ key, icon: Icon, label, highlight, warn }) => (
        <StatBox
          key={key}
          icon={<Icon className="h-4 w-4" />}
          label={label}
          value={loading ? null : (stats?.[key] ?? 0)}
          loading={loading}
          highlight={highlight}
          warn={warn}
        />
      ))}
    </div>
  );
}

function StatBox({ icon, label, value, highlight, warn, loading }) {
  return (
    <div className="bg-card border rounded-lg p-3 text-center">
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
      <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
