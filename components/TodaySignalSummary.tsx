import Link from "next/link";
import { Zap, AlertTriangle } from "lucide-react";

interface TodaySignalSummaryProps {
  items: any[];
}

/**
 * Summary bar shown at the top of the home page.
 * Displays counts of today's AI-analyzed signals.
 * Only renders when at least 1 item has been analyzed.
 */
export default function TodaySignalSummary({ items }: TodaySignalSummaryProps) {
  if (!items || items.length === 0) return null;

  // Count analyzed items with scores >= 3
  const analyzed = items.filter(
    (item: any) => item.analysis && item.analysis.signal_score >= 3
  );

  if (analyzed.length === 0) return null;

  const criticalCount = analyzed.filter(
    (item: any) => item.analysis.signal_score === 5
  ).length;
  const significantCount = analyzed.filter(
    (item: any) => item.analysis.signal_score === 4
  ).length;
  const moderateCount = analyzed.filter(
    (item: any) => item.analysis.signal_score === 3
  ).length;

  const totalNews = items.length;

  return (
    <Link
      href="/analysis"
      className="block mx-auto max-w-[720px] lg:max-w-[960px] xl:max-w-[1200px] px-4 sm:px-6 mt-2"
    >
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200/60 dark:border-blue-800/40 rounded-xl px-4 py-3 hover:shadow-md transition-all cursor-pointer">
        <div className="flex items-center gap-2 flex-wrap text-[12px] sm:text-[13px]">
          <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span className="text-muted-foreground">
            {totalNews} 条快讯中，AI 识别{" "}
            <span className="font-semibold text-foreground">
              {analyzed.length} 条值得关注信号
            </span>
          </span>
          <span className="text-muted-foreground">·</span>
          {criticalCount > 0 && (
            <>
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              <span className="font-semibold text-red-600 dark:text-red-400">
                {criticalCount} 条预警
              </span>
            </>
          )}
          {significantCount > 0 && (
            <span className="font-semibold text-orange-600 dark:text-orange-400">
              {significantCount} 条重要
            </span>
          )}
          {moderateCount > 0 && (
            <span className="font-semibold text-yellow-600 dark:text-yellow-400">
              {moderateCount} 条关注
            </span>
          )}
          <span className="text-primary text-[11px] ml-auto shrink-0">
            查看分析 →
          </span>
        </div>
      </div>
    </Link>
  );
}
