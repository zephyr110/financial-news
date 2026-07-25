import { Card, CardContent } from "./ui/card";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";

const categoryLabels = {
  policy: '政策',
  geopolitics: '地缘',
  industry: '行业',
  company: '公司',
  macro: '宏观',
  market_rumor: '传闻',
};

const categoryColors = {
  policy: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  geopolitics: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  industry: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  company: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  macro: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  market_rumor: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
};

const scoreColors = {
  5: 'bg-red-600 text-white',
  4: 'bg-orange-500 text-white',
  3: 'bg-yellow-500 text-white',
  2: 'bg-gray-400 text-white',
  1: 'bg-gray-300 text-gray-600',
};

export default function AnalysisNewsCard({ item }) {
  const time = item.published_at
    ? new Date(item.published_at)
    : null;

  const timeLabel =
    time && !isNaN(time.getTime())
      ? time.toLocaleTimeString("zh-CN", {
          hour12: false, hour: "2-digit", minute: "2-digit",
        })
      : "--:--";

  const dateLabel =
    time && !isNaN(time.getTime())
      ? time.toLocaleDateString("zh-CN", {
          month: "2-digit", day: "2-digit",
        })
      : "";

  return (
    <Card className="group cursor-pointer transition-all duration-200 hover:border-primary hover:shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Signal score badge */}
          <span className={cn(
            "inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0",
            scoreColors[item.signal_score] || scoreColors[1]
          )}>
            {item.signal_score}
          </span>

          <div className="min-w-0 flex-1">
            {/* Summary (LLM-generated) */}
            <p className="text-[13px] sm:text-sm lg:text-base leading-relaxed text-foreground font-medium">
              {item.summary}
            </p>

            {/* Original content (dimmed) */}
            <p className="mt-1 text-[11px] sm:text-xs text-muted-foreground line-clamp-2">
              {item.content}
            </p>

            {/* Tags row */}
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <Badge className={cn("text-[10px] px-1.5 py-0", categoryColors[item.category])}>
                {categoryLabels[item.category] || item.category}
              </Badge>

              {item.industries?.map((ind) => (
                <Badge key={ind} variant="outline" className="text-[10px] px-1.5 py-0">
                  {ind}
                </Badge>
              ))}

              <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                {dateLabel} {timeLabel}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
