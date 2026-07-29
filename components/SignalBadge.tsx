import { cn } from "@/lib/utils";

const SCORE_STYLES: Record<number, string> = {
  5: "bg-red-600 text-white",
  4: "bg-orange-500 text-white",
  3: "bg-yellow-500 text-white",
  2: "bg-gray-400 text-white",
  1: "bg-gray-300 text-gray-600",
};

const SIZE_CLASSES = {
  sm: "w-5 h-5 text-[10px]",
  md: "w-6 h-6 text-[11px]",
  lg: "w-8 h-8 text-xs",
};

interface SignalBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  clickable?: boolean;
  className?: string;
}

/**
 * Reusable signal score circular badge.
 * Mirrors SCORE_COLORS from lib/constants.ts.
 *
 * - score 3-5: filled colored circle with number
 * - score 2:   optionally hidden by default (showBelow=3 default)
 * - score 1:   hidden by default
 * - score null/undefined/0: empty circle (unanalyzed state)
 */
export default function SignalBadge({
  score,
  size = "md",
  clickable = false,
  className,
}: SignalBadgeProps) {
  // null/0/NaN/undefined → unanalyzed placeholder
  if (score == null || score === 0 || Number.isNaN(score)) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground/50 shrink-0",
          SIZE_CLASSES[size],
          className
        )}
        title="待分析"
        aria-label="待分析"
      >
        ○
      </span>
    );
  }

  // score 1-2: hide to reduce noise (override with className if needed)
  if (score <= 2) {
    return null;
  }

  const style = SCORE_STYLES[score] || SCORE_STYLES[3];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold shrink-0 select-none",
        style,
        SIZE_CLASSES[size],
        clickable && "cursor-pointer hover:scale-110 active:scale-95 transition-transform",
        className
      )}
      title={`信号强度 ${score}`}
      aria-label={`信号强度 ${score}`}
    >
      {score}
    </span>
  );
}
