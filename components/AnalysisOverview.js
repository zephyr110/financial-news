import { BarChart3, AlertTriangle, TrendingUp, Activity } from "lucide-react";

export default function AnalysisOverview({ stats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      <StatBox
        icon={<Activity className="h-4 w-4" />}
        label="信号新闻"
        value={stats.total_signals}
      />
      <StatBox
        icon={<TrendingUp className="h-4 w-4" />}
        label="重要信号"
        value={stats.significant_count}
        highlight
      />
      <StatBox
        icon={<BarChart3 className="h-4 w-4" />}
        label="最高分"
        value={stats.max_score}
      />
      <StatBox
        icon={<AlertTriangle className="h-4 w-4" />}
        label="预警"
        value={stats.critical_count}
        warn
      />
    </div>
  );
}

function StatBox({ icon, label, value, highlight, warn }) {
  return (
    <div className="bg-card border rounded-lg p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
        {icon}
      </div>
      <div className={`text-xl sm:text-2xl font-bold tabular-nums ${
        warn ? 'text-red-600 dark:text-red-400' :
        highlight ? 'text-primary' : 'text-foreground'
      }`}>
        {value ?? 0}
      </div>
      <div className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
