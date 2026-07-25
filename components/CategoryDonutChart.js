import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { CATEGORY_LABELS } from "@/lib/constants";

const COLORS = {
  policy: "hsl(0, 72%, 55%)",
  geopolitics: "hsl(30, 80%, 50%)",
  industry: "hsl(210, 80%, 55%)",
  company: "hsl(150, 60%, 40%)",
  macro: "hsl(270, 50%, 55%)",
  market_rumor: "hsl(45, 80%, 50%)",
};

const DEFAULT_COLOR = "hsl(200, 20%, 60%)";

/**
 * Donut chart — category distribution of analyzed signals.
 * Computes distribution client-side from items array.
 */
export default function CategoryDonutChart({ items }) {
  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8 text-[11px] sm:text-xs text-muted-foreground">
        暂无分类数据
      </div>
    );
  }

  // Aggregate by category
  const countMap = new Map();
  for (const item of items) {
    const cat = item.category || "macro";
    countMap.set(cat, (countMap.get(cat) || 0) + 1);
  }

  const chartData = Array.from(countMap.entries())
    .map(([cat, count]) => ({
      name: CATEGORY_LABELS[cat] || cat,
      value: count,
      color: COLORS[cat] || DEFAULT_COLOR,
    }))
    .sort((a, b) => b.value - a.value);

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={2}
          dataKey="value"
          stroke="none"
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontSize: 12,
          }}
          formatter={(value) => [`${value} 条 (${((value / total) * 100).toFixed(0)}%)`]}
        />
        {/* Center text — total count */}
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground"
          style={{ fontSize: 20, fontWeight: 700 }}
        >
          {total}
        </text>
        <text
          x="50%"
          y="50%"
          dy={18}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 11 }}
        >
          条信号
        </text>
      </PieChart>
    </ResponsiveContainer>
  );
}
