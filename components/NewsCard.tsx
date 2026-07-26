import { Card, CardContent } from "./ui/card";
import { cn } from "@/lib/utils";
import { parseItemTime, formatTime } from "@/lib/format";

export default function NewsCard({ item, index }) {
  const isAnimated = index < 10;
  const time = parseItemTime(item);
  const text = item.rich_text || item.content || "";

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
          {item.docurl && (
            <div className="mt-2">
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
