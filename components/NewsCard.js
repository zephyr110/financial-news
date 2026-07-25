import { Card, CardContent } from "./ui/card";
import { cn } from "@/lib/utils";

function parseItemTime(item) {
  if (item.published_at) {
    const d = new Date(item.published_at);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (item.create_time) {
    const d = new Date(String(item.create_time).replace(" ", "T") + "+08:00");
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export default function NewsCard({ item, index }) {
  const isAnimated = index < 10;
  const time = parseItemTime(item);
  const text = item.rich_text || item.content || "";

  const timeLabel = time
    ? time.toLocaleTimeString("zh-CN", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Shanghai",
      })
    : "--:--";

  return (
    <Card
      className={cn(
        "group transition-all duration-200 hover:border-primary hover:shadow-sm",
        isAnimated && "news-card"
      )}
      style={isAnimated ? { animationDelay: `${index * 50}ms` } : undefined}
    >
      <CardContent className="p-4 flex gap-3">
        <span className="text-[11px] sm:text-xs lg:text-sm text-muted-foreground tabular-nums shrink-0 mt-0.5 font-medium">
          {timeLabel}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] sm:text-sm lg:text-base leading-relaxed text-foreground">
            {text}
          </p>
          {item.docurl && (
            <div className="mt-1.5">
              <a
                href={item.docurl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] sm:text-xs text-primary no-underline hover:underline"
              >
                原文
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
