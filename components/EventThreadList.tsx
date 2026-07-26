import { useState } from "react";
import { ChevronDown, TrendingUp, AlertCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const stageLabels = {
  early: "早期",
  brewing: "发酵中",
  spreading: "全面扩散",
  priced_in: "成熟定价",
};

const stageColors = {
  early: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  brewing: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  spreading: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  priced_in: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const confidenceIcons = {
  high: { icon: Zap, color: "text-amber-500" },
  medium: { icon: AlertCircle, color: "text-muted-foreground" },
};

export default function EventThreadList({ threads }) {
  if (!threads || threads.length === 0) return null;

  return (
    <div className="bg-card border rounded-xl p-4 sm:p-5 mb-6">
      <h3 className="text-xs sm:text-sm font-medium text-foreground mb-3 flex items-center gap-1.5">
        <TrendingUp className="h-4 w-4 text-primary" />
        事件线索
      </h3>
      <div className="space-y-3">
        {threads.map((thread) => (
          <EventThreadCard key={thread.id} thread={thread} />
        ))}
      </div>
    </div>
  );
}

function EventThreadCard({ thread }) {
  const [open, setOpen] = useState(false);
  const ConfidenceIcon = confidenceIcons[thread.confidence]?.icon || AlertCircle;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-accent/50 transition-colors"
      >
        <ConfidenceIcon
          className={cn("h-4 w-4 shrink-0", confidenceIcons[thread.confidence]?.color)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[13px] sm:text-sm font-medium text-foreground">
              {thread.title}
            </span>
            <span className={cn(
              "text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-full font-medium",
              stageColors[thread.stage] || stageColors.early
            )}>
              {stageLabels[thread.stage] || thread.stage}
            </span>
          </div>
          {!open && (
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {thread.narrative}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0">
          <span>{thread.news_ids?.length || 0} 条</span>
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
          />
        </div>
      </button>

      {open && (
        <div className="px-3 pb-3 border-t pt-2 space-y-2">
          <p className="text-[12px] sm:text-[13px] text-foreground leading-relaxed">
            {thread.narrative}
          </p>
          {thread.industries?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground">涉及行业：</span>
              {thread.industries.map((ind) => (
                <span
                  key={ind}
                  className="text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground"
                >
                  {ind}
                </span>
              ))}
            </div>
          )}
          {thread.watch_points?.length > 0 && (
            <div>
              <span className="text-[10px] text-muted-foreground">后续关注：</span>
              <ul className="mt-1 space-y-0.5">
                {thread.watch_points.map((p, i) => (
                  <li key={i} className="text-[11px] sm:text-xs text-muted-foreground flex items-start gap-1">
                    <span className="text-primary mt-0.5">•</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
