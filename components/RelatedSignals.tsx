import Link from "next/link";
import SignalBadge from "./SignalBadge";
import { CATEGORY_LABELS } from "@/lib/constants";

interface RelatedSignalItem {
  id: number;
  signal_score: number;
  category: string;
  industries: string[];
  summary: string;
  published_at: string;
}

interface RelatedSignalsProps {
  items: RelatedSignalItem[];
}

/**
 * Related signals list — shown on the signal detail page.
 * Displays other signals sharing the same industries or companies.
 */
export default function RelatedSignals({ items }: RelatedSignalsProps) {
  if (!items || items.length === 0) return null;

  return (
    <div className="border rounded-xl p-4 sm:p-5">
      <h3 className="text-xs sm:text-sm font-medium text-foreground mb-3">
        相关信号
      </h3>
      <div className="space-y-2">
        {items.map((item) => {
          const timeStr = formatSignalTime(item.published_at);
          return (
            <Link
              key={item.id}
              href={`/signal/${item.id}`}
              className="block border rounded-lg p-3 hover:bg-accent/40 transition-colors group"
            >
              <div className="flex items-start gap-2.5">
                <SignalBadge score={item.signal_score} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] sm:text-[13px] text-foreground leading-relaxed line-clamp-2 group-hover:text-primary transition-colors">
                    {item.summary}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {item.category && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground">
                        {CATEGORY_LABELS[item.category] || item.category}
                      </span>
                    )}
                    {item.industries?.slice(0, 2).map((ind: string) => (
                      <span key={ind} className="text-[10px] text-muted-foreground">
                        {ind}
                      </span>
                    ))}
                    <span className="text-[10px] text-muted-foreground/60 ml-auto">
                      {timeStr}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function formatSignalTime(isoString: string): string {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = Math.floor(diffMs / 3600000);
  if (diffH < 1) return "刚刚";
  if (diffH < 24) return `${diffH}h 前`;
  return d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}
