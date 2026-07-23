import { Card, CardContent } from "./ui/card";
import { cn } from "@/lib/utils";

export default function NewsCard({ item, index }) {
  const isAnimated = index < 10;

  const time = item.create_time
    ? new Date(item.create_time.replace(" ", "T") + "+08:00")
    : null;

  const timeLabel =
    time && !isNaN(time.getTime())
      ? time.toLocaleTimeString("zh-CN", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        })
      : "--:--";

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-sm",
        isAnimated && "news-card"
      )}
      style={isAnimated ? { animationDelay: `${index * 50}ms` } : undefined}
    >
      <CardContent className="p-4 flex gap-3">
        <span className="text-[11px] sm:text-xs lg:text-sm text-muted-foreground tabular-nums shrink-0 mt-0.5 font-medium">
          {index + 1}
        </span>
        <div className="min-w-0">
        <p className="text-[13px] sm:text-sm lg:text-base leading-relaxed text-foreground">
          {item.rich_text}
        </p>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
          {item.docurl ? (
            <a
              href={item.docurl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary no-underline hover:underline tabular-nums"
            >
              {timeLabel}
            </a>
          ) : (
            <span className="tabular-nums">{timeLabel}</span>
          )}
          <span>·</span>
          <span>新浪财经</span>
        </div>
        </div>
      </CardContent>
    </Card>
  );
}
