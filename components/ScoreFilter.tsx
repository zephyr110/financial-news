import { cn } from "@/lib/utils";
import { SCORE_COLORS, SCORE_LABELS } from "@/lib/constants";

const SCORES = [5, 4, 3, 2, 1];

// Extract bg color from SCORE_COLORS, keeping text color for readability
function scoreBadgeStyle(score) {
  const val = SCORE_COLORS[score] || "bg-gray-400 text-white";
  const parts = val.split(" ");
  return parts.join(" ");
}

export default function ScoreFilter({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 mb-4 flex-wrap">
      <span className="text-[11px] sm:text-xs text-muted-foreground shrink-0">
        按分数：
      </span>
      {SCORES.map((score) => {
        const active = value === score;
        return (
          <button
            key={score}
            type="button"
            onClick={() => onChange(active ? null : score)}
            className={cn(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium transition-all border-2",
              active
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-border bg-card hover:border-primary/40 hover:bg-accent"
            )}
          >
            <span
              className={cn(
                "inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold",
                scoreBadgeStyle(score)
              )}
            >
              {score}
            </span>
            <span className="hidden sm:inline">{SCORE_LABELS[score]}</span>
          </button>
        );
      })}
    </div>
  );
}
