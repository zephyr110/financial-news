import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_COLORS, SCORE_COLORS } from "@/lib/constants";
import { parseItemTime, formatTime, formatDate } from "@/lib/format";

export default function AnalysisNewsCard({ item }) {
  const time = parseItemTime(item);
  const timeLabel = formatTime(time);
  const dateLabel = formatDate(time);

  return (
    <Card className="group cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <span className={cn(
            "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0",
            SCORE_COLORS[item.signal_score] || SCORE_COLORS[1]
          )}>
            {item.signal_score}
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-[13px] sm:text-sm lg:text-base leading-loose text-foreground font-medium">
              {item.summary}
            </p>

            <p className="mt-2.5 text-[11px] sm:text-xs text-muted-foreground">
              {item.content}
            </p>

            <div className="mt-2.5 flex items-center gap-2 flex-wrap">
              <Badge className={cn("text-[11px] sm:text-xs px-1.5 py-0", CATEGORY_COLORS[item.category])}>
                {CATEGORY_LABELS[item.category] || item.category}
              </Badge>

              {item.source && (
                <Badge variant="secondary" className="text-[10px] sm:text-[11px] px-1.5 py-0">
                  {item.source === 'sina' ? '新浪' : item.source === 'eastmoney' ? '东财' : item.source}
                </Badge>
              )}

              {item.industries?.map((ind) => (
                <Badge key={ind} variant="outline" className="text-[11px] sm:text-xs px-1.5 py-0">
                  {ind}
                </Badge>
              ))}

              <span className="text-[11px] sm:text-xs text-muted-foreground ml-auto tabular-nums">
                {dateLabel} {timeLabel}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
