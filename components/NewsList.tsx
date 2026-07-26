import { useMemo, useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import NewsCard from "./NewsCard";
import { cn } from "@/lib/utils";
import { dateKeyFromItem, todayKey, formatDayLabel } from "@/lib/format";

function groupByDate(items) {
  const map = new Map();
  for (const item of items) {
    const key = dateKeyFromItem(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return Array.from(map.entries()).map(([date, dayItems]) => ({
    date,
    items: dayItems,
  }));
}

export default function NewsList({ items }) {
  const groups = useMemo(() => groupByDate(items || []), [items]);
  const today = todayKey();

  const [collapsed, setCollapsed] = useState(() => {
    const t = todayKey();
    const initial = {};
    for (const item of items || []) {
      const key = dateKeyFromItem(item);
      if (key !== t) initial[key] = true;
    }
    return initial;
  });

  useEffect(() => {
    setCollapsed((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (g.date !== today && !(g.date in next)) {
          next[g.date] = true;
        }
      }
      return next;
    });
  }, [groups, today]);

  if (!items || items.length === 0) return null;

  const toggle = (date) => {
    setCollapsed((prev) => ({ ...prev, [date]: !prev[date] }));
  };

  return (
    <div className="relative">
      <style jsx global>{`
        .news-card {
          opacity: 0;
          animation: fadeInUp 0.3s ease-out forwards;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .news-card {
            opacity: 1;
            animation: none;
          }
        }
      `}</style>

      <div
        className="absolute left-[7px] top-2 bottom-2 w-px bg-border"
        aria-hidden
      />

      <div className="space-y-6">
        {groups.map((group) => {
          const isCollapsed = collapsed[group.date] === true;
          const isToday = group.date === today;

          return (
            <section key={group.date} className="relative pl-6">
              <button
                type="button"
                onClick={() => toggle(group.date)}
                className="flex w-full items-center gap-2 mb-3 text-left group"
                aria-expanded={!isCollapsed}
              >
                <span
                  className={cn(
                    "absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 bg-background",
                    isToday ? "border-primary" : "border-muted-foreground/40"
                  )}
                  aria-hidden
                />
                <span className="text-sm font-medium text-foreground">
                  {formatDayLabel(group.date)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {group.items.length}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform ml-auto",
                    isCollapsed ? "-rotate-90" : "rotate-0"
                  )}
                />
              </button>

              {!isCollapsed && (
                <ul className="space-y-4 list-none">
                  {group.items.map((item, i) => (
                    <li key={item.id ?? `${group.date}-${i}`}>
                      <NewsCard item={item} index={i} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
