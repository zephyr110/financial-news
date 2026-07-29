import Link from "next/link";
import { Card, CardContent } from "./ui/card";
import { cn } from "@/lib/utils";
import { parseItemTime, formatTime } from "@/lib/format";
import SignalBadge from "./SignalBadge";

export default function NewsCard({ item, index }) {
  const isAnimated = index < 10;
  const time = parseItemTime(item);
  const text = item.rich_text || item.content || "";
  const analysis = item.analysis;
  const hasSignal = analysis && analysis.signal_score >= 3;

  return (
    <Card
      className={cn(
        "group transition-all duration-200 hover:border-primary hover:shadow-sm",
        isAnimated && "news-card"
      )}
      style={isAnimated ? { animationDelay: `${index * 50}ms` } : undefined}
    >
      <CardContent className="p-4 sm:p-5 flex gap-3 sm:gap-4">
        <span className="text-[11px] sm:text-xs lg:text-sm text-muted-foreground tabular-nums shrink-0 mt-[5px] font-medium">
          {formatTime(time)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] sm:text-sm lg:text-base leading-loose text-foreground">
            {text}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            {item.docurl && (
              <a
                href={item.docurl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] sm:text-xs text-primary no-underline hover:underline"
              >
                原文
              </a>
            )}
          </div>
        </div>

        {/* Signal badge or unanalyzed indicator */}
        <div className="shrink-0 flex items-start mt-[3px]">
          {hasSignal ? (
            <Link href={`/signal/${analysis.id}`} title="查看信号分析">
              <SignalBadge score={analysis.signal_score} size="sm" clickable />
            </Link>
          ) : analysis ? (
            /* Analyzed but low score — show subtle indicator */
            <span
              className="w-4 h-4 rounded-full border border-dashed border-muted-foreground/30 flex items-center justify-center text-[8px] text-muted-foreground/40"
              title="低分信号"
            >
              {analysis.signal_score}
            </span>
          ) : (
            /* Unanalyzed — subtle hollow circle */
            <SignalBadge score={0} size="sm" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
