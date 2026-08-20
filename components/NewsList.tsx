import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import NewsCard from "./NewsCard";
import { cn } from "@/lib/utils";
import { dateKeyFromItem, todayKey, formatDayLabel } from "@/lib/format";

function groupByDate(items: any[]) {
  const map = new Map<string, any[]>();
  for (const item of items) {
    const key = dateKeyFromItem(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  return Array.from(map.entries()).map(([date, dayItems]) => ({ date, items: dayItems }));
}

interface Props {
  todayItems: any[];
  pastDates: string[];
}

export default function NewsList({ todayItems, pastDates }: Props) {
  const today = todayKey();

  // Past date states: { [date]: { loading: bool, items: any[] } }
  const [todayCollapsed, setTodayCollapsed] = useState(false);

  const [pastState, setPastState] = useState<Record<string, { loading: boolean; items: any[] }>>({});

  // All past dates collapsed by default
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const d of pastDates) init[d] = true;
    return init;
  });

  const todayGroups = groupByDate(todayItems || []);

  const toggleDate = async (date: string) => {
    const isCollapsed = collapsed[date];

    if (isCollapsed && !pastState[date]) {
      // First expand — fetch data for this date
      setCollapsed(prev => ({ ...prev, [date]: false }));
      setPastState(prev => ({ ...prev, [date]: { loading: true, items: [] } }));
      try {
        const res = await fetch(`/api/news?date=${date}`);
        if (res.ok) {
          const data = await res.json();
          setPastState(prev => ({ ...prev, [date]: { loading: false, items: data.items || [] } }));
        } else {
          setPastState(prev => ({ ...prev, [date]: { loading: false, items: [] } }));
        }
      } catch {
        setPastState(prev => ({ ...prev, [date]: { loading: false, items: [] } }));
        setCollapsed(prev => ({ ...prev, [date]: true }));
      }
    } else {
      // Toggle collapse
      setCollapsed(prev => ({ ...prev, [date]: !prev[date] }));
    }
  };

  if (todayItems.length === 0 && pastDates.length === 0) return null;

  return (
    <div className="relative">
      <style jsx global>{`
        .news-card {
          opacity: 0;
          animation: fadeInUp 0.3s ease-out forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .news-card { opacity: 1; animation: none; }
        }
      `}</style>

      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" aria-hidden />

      <div className="space-y-6">
        {/* Today — toggleable, default expanded */}
        {todayGroups.map((group) => (
          <section key={group.date} className="relative pl-6">
            <button
              type="button"
              onClick={() => setTodayCollapsed(!todayCollapsed)}
              className="flex w-full items-center gap-2 mb-3 text-left group"
              aria-expanded={!todayCollapsed}
            >
              <span
                className={cn(
                  "absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 bg-background",
                  "border-primary"
                )}
                aria-hidden
              />
              <span className="text-sm font-medium text-foreground">
                {formatDayLabel(group.date)}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground tabular-nums">
                {group.items.length} 条
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform ml-auto",
                  todayCollapsed ? "-rotate-90" : "rotate-0"
                )}
              />
            </button>
            <div
              className={cn(
                "overflow-hidden transition-all duration-300 ease-in-out",
                todayCollapsed ? "max-h-0 opacity-0" : "max-h-[9999px] opacity-100"
              )}
            >
              <ul className="space-y-4 list-none">
                {group.items.map((item, i) => (
                  <li key={item.id ?? `${group.date}-${i}`}>
                    <NewsCard item={item} index={i} />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}

        {/* Past dates — collapsed, lazy load on expand */}
        {pastDates.map((date) => {
          const isCollapsed = collapsed[date];
          const state = pastState[date];
          const groups = state?.items ? groupByDate(state.items) : [];

          return (
            <section key={date} className="relative pl-6">
              <button
                type="button"
                onClick={() => toggleDate(date)}
                className="flex w-full items-center gap-2 mb-3 text-left group"
                aria-expanded={!isCollapsed}
              >
                <span
                  className={cn(
                    "absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border-2 bg-background",
                    "border-muted-foreground/40"
                  )}
                  aria-hidden
                />
                <span className="text-sm font-medium text-foreground">
                  {formatDayLabel(date)}
                </span>
                {state?.loading ? (
                  <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />
                ) : state?.items ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground tabular-nums">
                    {state.items.length} 条
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/60">
                    点击展开
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform ml-auto",
                    isCollapsed ? "-rotate-90" : "rotate-0"
                  )}
                />
              </button>

              <div
                className={cn(
                  "overflow-hidden transition-all duration-300 ease-in-out",
                  !isCollapsed && state && !state.loading && groups.length > 0
                    ? "max-h-[9999px] opacity-100"
                    : "max-h-0 opacity-0"
                )}
              >
                {state && !state.loading && groups.length > 0 && (
                  <ul className="space-y-4 list-none">
                    {groups.flatMap(g => g.items).map((item, i) => (
                      <li key={item.id ?? `${date}-${i}`}>
                        <NewsCard item={item} index={i} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
