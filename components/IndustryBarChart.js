import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

/**
 * Horizontal bar chart — industry signal counts with avg score.
 * Styled to match shadcn/ui design tokens.
 */
export default function IndustryBarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-[11px] sm:text-xs text-muted-foreground">
        暂无行业数据
      </div>
    );
  }

  // Take top 8, sorted by count desc (already sorted from API)
  const chartData = data.slice(0, 8).map((d) => ({
    name: d.industry.length > 5 ? d.industry.slice(0, 5) + "…" : d.industry,
    fullName: d.industry,
    count: d.signalCount,
    score: d.avgScore,
  }));

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: "var(--foreground)" }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontSize: 12,
          }}
          formatter={(value, name) => {
            if (name === "count") return [`${value} 条`, "信号数"];
            if (name === "score") return [value, "均分"];
            return [value, name];
          }}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={`hsl(${220 + entry.score * 8}, 70%, ${55 - entry.score * 3}%)`}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
