import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendDeltaProps {
  current: number | null | undefined;
  previous: number | null | undefined;
  /** "number" shows raw diff, "decimal" shows percentage points (1 dp) */
  format?: "number" | "decimal";
  /** Label for the previous period, e.g. "昨日" */
  label?: string;
  className?: string;
}

/**
 * Trend comparison indicator — shows change vs previous period.
 *
 * - positive: green up arrow
 * - negative: red down arrow
 * - zero: gray dash (持平)
 * - missing (null/undefined/NaN): renders nothing
 */
export default function TrendDelta({
  current,
  previous,
  format = "number",
  label = "昨日",
  className,
}: TrendDeltaProps) {
  if (
    current == null ||
    previous == null ||
    Number.isNaN(current) ||
    Number.isNaN(previous)
  ) {
    return null;
  }

  const diff = current - previous;
  const absDiff = Math.abs(diff);
  const isZero = Math.abs(diff) < 0.001;

  let formatted: string;
  if (isZero) {
    formatted = "持平";
  } else if (format === "decimal") {
    formatted = `${diff > 0 ? "+" : ""}${diff.toFixed(1)}`;
  } else {
    // "number": most metrics are integers
    const d = Math.round(absDiff);
    if (d === 0) {
      // close enough to zero
      formatted = "持平";
      return (
        <span className={cn("inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] text-muted-foreground", className)}>
          <Minus className="h-3 w-3" />
          <span>{formatted}</span>
        </span>
      );
    }
    formatted = `${diff > 0 ? "+" : "-"}${d}`;
  }

  // Edge case: was zero previously — avoid division by zero in display
  const pct =
    previous !== 0
      ? Math.round((diff / Math.abs(previous)) * 100)
      : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-medium",
        isZero
          ? "text-muted-foreground"
          : diff > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-red-600 dark:text-red-400",
        className
      )}
    >
      {isZero ? (
        <Minus className="h-3 w-3" />
      ) : diff > 0 ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      <span>
        {formatted}
        {pct != null && pct !== 0 && ` vs ${label}`}
        {pct != null && pct !== 0 && (
          <span className="ml-0.5 opacity-70">
            ({pct > 0 ? "+" : ""}{pct}%)
          </span>
        )}
        {pct === 0 && !isZero && ` vs ${label}`}
      </span>
    </span>
  );
}
