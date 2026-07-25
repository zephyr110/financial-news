import { useMemo } from "react";

// Colors for tags (rotate through)
const TAG_COLORS = [
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
 * Word cloud from LLM-generated tags in analyzed items.
 * Tag size is proportional to frequency.
 */
export default function WordCloud({ items }) {
  const tags = useMemo(() => {
    if (!items || items.length === 0) return [];

    const countMap = new Map();
    for (const item of items) {
      // Use tags if available; fall back to industries (always populated by LLM)
      const source = (item.tags && Array.isArray(item.tags) && item.tags.length > 0)
        ? item.tags
        : (Array.isArray(item.industries) ? item.industries : []);
      for (const tag of source) {
        if (!tag || !tag.trim()) continue;
        countMap.set(tag, (countMap.get(tag) || 0) + 1);
      }
    }

    const entries = Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30);

    if (entries.length === 0) return [];

    const maxCount = entries[0][1];
    const minCount = entries[entries.length - 1][1];

    return entries.map(([tag, count], i) => {
      // Map count to font size: min=12px, max=28px
      const ratio = maxCount === minCount ? 0.5 : (count - minCount) / (maxCount - minCount);
      const size = 12 + ratio * 16;
      const weight = ratio > 0.6 ? 700 : ratio > 0.3 ? 600 : 500;
      const opacity = 0.45 + ratio * 0.55;
      return {
        tag,
        count,
        size,
        weight,
        opacity,
        color: TAG_COLORS[i % TAG_COLORS.length],
      };
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
          style={{
            fontSize: `${size}px`,
            fontWeight: weight,
            opacity,
            lineHeight: 1.4,
          }}
          title={`${tag}（${count}次）`}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}
