import { BarChart, Bar, XAxis, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { CATEGORY_LABELS } from "@/lib/constants";

// Consistent with card gradient colors
const COLORS = {
  policy:       "#e11d48", // rose
  geopolitics:  "#f97316", // orange
  industry:     "#2563eb", // blue
  company:      "#16a34a", // green
  macro:        "#7c3aed", // violet
  market_rumor: "#ca8a04", // yellow
};
const FALLBACK = "#6b7280";

/**
 * Horizontal bar chart — category distribution of quality signals (score ≥ 3).
 * Filters out noise to show only meaningful distribution.
 */
export default function CategoryDonutChart({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8 text-[11px] sm:text-xs text-muted-foreground">
        暂无分类数据
      </div>
    );
  }

  // Only count quality signals (score >= 3, excluding noise)
  const qualityItems = items.filter(i => i.signal_score >= 3);

  if (qualityItems.length === 0) {
    return (
      <div className="text-center py-8 text-[11px] sm:text-xs text-muted-foreground">
        暂无高质量信号（≥3分）
      </div>
    );
  }

  const total = qualityItems.length;

  // Aggregate by category
  const countMap = new Map();
  for (const item of qualityItems) {
    const cat = item.category || "macro";
    countMap.set(cat, (countMap.get(cat) || 0) + 1);
  }

  const chartData = Array.from(countMap.entries())
    .map(([cat, count]) => ({
      name: CATEGORY_LABELS[cat] || cat,
      key: cat,
      value: count,
      pct: ((count / total) * 100).toFixed(0),
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
        {chartData.map((d) => (
          <div key={d.key} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: COLORS[d.key] || FALLBACK }}
            />
            <span className="text-[11px] sm:text-xs text-muted-foreground">
              {d.name} {d.value}
            </span>
          </div>
        ))}
      </div>

      {/* Horizontal bars */}
      <ResponsiveContainer width="100%" height={Math.max(120, chartData.length * 32)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 32, left: 0, bottom: 0 }}
        >
          <XAxis type="number" hide />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 12,
              color: "var(--foreground)",
            }}
            labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
            itemStyle={{ color: "var(--muted-foreground)" }}
            formatter={(value) => [`${value} 条 (${((value / total) * 100).toFixed(0)}%)`]}
          />
          <Bar
            dataKey="value"
            radius={[0, 4, 4, 0]}
            maxBarSize={22}
            label={({ payload }) => `${payload.value}条  ${payload.pct}%`}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={COLORS[entry.key] || FALLBACK} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1">
        仅统计 ≥3 分的高质量信号，共 {total} 条
      </p>
    </div>
  );
}
