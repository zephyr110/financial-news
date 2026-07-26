import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    fontSize: 12,
    color: "var(--foreground)",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 600 },
  itemStyle: { color: "var(--muted-foreground)" },
};

export default function IndustryBarChart({ data }) {
  const [hoverIndex, setHoverIndex] = useState(-1);

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-[11px] sm:text-xs text-muted-foreground">
        暂无行业数据
      </div>
    );
  }

  const chartData = data.slice(0, 8).map((d) => {
    const name = (d.industry || "未知").slice(0, 6) + (d.industry && d.industry.length > 6 ? "…" : "");
    return {
      name,
      fullName: d.industry || "未知",
      count: d.signalCount || 0,
      score: d.avgScore || 0,
    };
  });

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 36)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 4, bottom: 4 }}
        onMouseLeave={() => setHoverIndex(-1)}
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
          {...TOOLTIP_STYLE}
          formatter={(value, name) => {
            if (name === "count") return [`${value} 条`, "信号数"];
            return [value, name];
          }}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ""}
        />
        <Bar
          dataKey="count"
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
          cursor="pointer"
          onMouseEnter={(_, i) => setHoverIndex(i)}
        >
          {chartData.map((entry, i) => {
            const score = entry.score || 0;
            const baseHue = 220 + score * 8;
            const baseLight = 55 - score * 3;
            const isHovered = hoverIndex === i;
            return (
              <Cell
                key={entry.fullName}
                fill={`hsl(${baseHue}, 70%, ${baseLight}%)`}
                fillOpacity={hoverIndex === -1 || isHovered ? 1 : 0.4}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
