import { cn } from "@/lib/utils";
import { SCORE_COLORS } from "@/lib/constants";

const SCORES = [5, 4, 3, 2, 1];

const SCORE_LABELS = {
  5: "重大",
  4: "重要",
  3: "关注",
  2: "一般",
  1: "噪声",
};

export default function ScoreFilter({ value, onChange }) {
  return (
    <div className="flex items-center gap-1.5 mb-4">
      <span className="text-[11px] sm:text-xs text-muted-foreground shrink-0">
        按分数筛选：
      </span>
      {SCORES.map((score) => {
        const active = value === score;
        return (
          <button
            key={score}
            type="button"
            onClick={() => onChange(active ? null : score)}
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-medium transition-all border",
              active
                ? "border-primary/50 shadow-sm scale-105"
                : "border-transparent hover:border-border opacity-70 hover:opacity-100"
            )}
          >
            <span
              className={cn(
                "inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white",
                SCORE_COLORS[score]?.split(" ")[0] || "bg-gray-400"
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
