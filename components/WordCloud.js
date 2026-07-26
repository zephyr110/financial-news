import { useMemo } from "react";
import { CATEGORY_LABELS } from "@/lib/constants";

const COLORS = [
  "text-[#2563eb]",
  "text-[#e11d48]",
  "text-[#16a34a]",
  "text-[#f97316]",
  "text-[#7c3aed]",
  "text-[#ca8a04]",
  "text-[#0891b2]",
  "text-[#be185d]",
];

/**
 * Multi-source weighted word cloud:
 * - tags (weight 2): LLM-generated event keywords (most specific)
 * - industries (weight 1): 申万行业分类
 * - category (weight 0.5): 信号分类标签
 * - companies (weight 0.5): A股公司名称
 *
 * Tags dominate when available (after deep-analyze runs).
 * Until then, industries + categories provide meaningful coverage.
 */
export default function WordCloud({ items }) {
  const tags = useMemo(() => {
    if (!items || items.length === 0) return [];

    const countMap = new Map();

    const addWeighted = (arr, weight) => {
      if (!arr || !Array.isArray(arr) || arr.length === 0) return;
      for (const val of arr) {
        if (!val || !val.trim()) continue;
        countMap.set(val, (countMap.get(val) || 0) + weight);
      }
    };

    for (const item of items) {
      addWeighted(item.tags, 2);                  // event keywords (top priority)
      addWeighted(item.industries, 1);            // industry names
      if (item.category) {
        const label = CATEGORY_LABELS[item.category];
        if (label) {
          countMap.set(label, (countMap.get(label) || 0) + 0.5);
        }
      }
      addWeighted(item.companies, 0.5);           // company tickers for variety
    }

    const entries = Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);

    if (entries.length === 0) return [];

    const maxCount = entries[0][1];
    const minCount = entries[entries.length - 1][1];

    return entries.map(([tag, count], i) => {
      const ratio = maxCount === minCount ? 0.5 : (count - minCount) / (maxCount - minCount);
      const size = 12 + ratio * 16;
      const weight = ratio > 0.6 ? 700 : ratio > 0.3 ? 600 : 500;
      const opacity = 0.45 + ratio * 0.55;
      return { tag, count: Math.round(count), size, weight, opacity, color: COLORS[i % COLORS.length] };
    });
  }, [items]);

  if (tags.length === 0) {
    return (
      <div className="text-center py-8 text-[11px] sm:text-xs text-muted-foreground">
        暂无热词数据
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 py-2">
      {tags.map(({ tag, count, size, weight, opacity, color }) => (
        <span
          key={tag}
          className={`${color} inline-block transition-all hover:scale-110 cursor-default`}
          style={{ fontSize: `${size}px`, fontWeight: weight, opacity, lineHeight: 1.4 }}
          title={`${tag}（${count}次）`}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
