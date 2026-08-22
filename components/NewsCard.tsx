import Link from "next/link";
import { Card, CardContent } from "./ui/card";
import { cn } from "@/lib/utils";
import { parseItemTime, formatTime } from "@/lib/format";
import SignalBadge from "./SignalBadge";

interface NewsCardProps {
  item: {
    id?: number | string;
    rich_text?: string;
    content?: string;
    docurl?: string;
    published_at?: string;
    create_time?: string;
    analysis?: {
      id: number;
      signal_score: number;
      category: string;
    } | null;
  };
  index: number;
}

export default function NewsCard({ item, index }: NewsCardProps) {
  const isAnimated = index < 10;
  const time = parseItemTime(item);
  const text = item.rich_text || item.content || "";
  const analysis = item.analysis;
  const hasSignal = analysis && analysis.signal_score >= 3;

  return (
    <Card
      className={cn(
        // 用户要求：卡片 hover 无动画/无边框变色/无阴影（group 仅用于「阅读原文」链接 hover 显示）
        "group",
        isAnimated && "news-card",
        analysis && !hasSignal && "opacity-80"
      )}
      style={isAnimated ? { animationDelay: `${index * 50}ms` } : undefined}
    >
      <CardContent className="p-4 sm:p-5 flex gap-3 sm:gap-4">
        <span className="text-xs lg:text-sm text-muted-foreground tabular-nums shrink-0 mt-[5px] font-medium">
          {formatTime(time)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm lg:text-base leading-loose text-foreground">
            {text}
          </p>
          {/* 原文链接：hover 卡片时显现，保持布局稳定 */}
          <div className="h-0 overflow-hidden opacity-0 transition-all duration-200 group-hover:h-auto group-hover:opacity-100">
            <div className="flex items-center gap-2 pt-1.5">
              {item.docurl && (
                <a
                  href={item.docurl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary no-underline hover:underline"
                >
                  阅读原文
                </a>
              )}
              {analysis && (
                <span className="text-xs text-muted-foreground">
                  {analysis.category || ""}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Signal badge or unanalyzed indicator */}
        <div className="shrink-0 flex items-start mt-[3px]">
          {hasSignal ? (
            <Link href={`/signal/${analysis.id}`} title="查看信号分析">
              <SignalBadge score={analysis.signal_score} size="sm" clickable />
            </Link>
          ) : analysis ? (
            /* Analyzed but low score — hollow circle showing the score (cards are dimmed via opacity) */
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-xs font-medium text-muted-foreground"
              title={`低分信号（${analysis.signal_score} 分）`}
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
