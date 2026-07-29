import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    fontSize: 12,
    color: "var(--foreground)",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 600 as const },
  itemStyle: { color: "var(--muted-foreground)" },
};

interface CompanyHeatmapItem {
  company: string;
  signalCount: number;
  avgScore: number;
}

interface CompanyHeatmapProps {
  data: CompanyHeatmapItem[];
}

/**
 * Horizontal bar chart — top 10 most-mentioned companies.
 * Bar color intensity reflects average signal score (3-5 mapped to HSL).
 */
export default function CompanyHeatmap({ data }: CompanyHeatmapProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-[11px] sm:text-xs text-muted-foreground">
        暂无公司数据
      </div>
    );
  }

  // Largest count for bar width scaling
  const maxCount = Math.max(...data.map((d) => d.signalCount), 1);

  const chartData = data.map((d, i) => ({
    ...d,
    // Progressive HSL color: hue from 0 (red/high score) to 210 (blue/low score)
    fill: avgScoreToColor(d.avgScore),
  }));

  return (
    <div>
      <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 32)}>
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
            dataKey="company"
            tick={{ fontSize: 11, fill: "var(--foreground)" }}
            axisLine={false}
            tickLine={false}
            width={80}
          />
          <Tooltip
            {...TOOLTIP_STYLE}
            formatter={(_value: number, _name: string, props: any) => [
              `${props.payload.signalCount} 次 · 均分 ${props.payload.avgScore}`,
              "提及",
            ]}
          />
          <Bar dataKey="signalCount" radius={[0, 4, 4, 0]} maxBarSize={24}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1">
        Top 10 被提及公司 · 仅统计 ≥3 分信号 · 柱色深浅 = 平均信号强度
      </p>
    </div>
  );
}

/**
 * Map average signal score (3-5) to a color.
 * High score → warm/red, low score → cool/blue.
 */
function avgScoreToColor(score: number): string {
  // Clamp between 3 and 5
  const clamped = Math.max(3, Math.min(5, score));
  // t = 0 at score 3, t = 1 at score 5
  const t = (clamped - 3) / 2;
  // hue: red (0) to blue (220), saturation: 70%, lightness: 50%
  const h = Math.round(220 * (1 - t));
  return `hsl(${h}, 65%, ${45 + t * 10}%)`;
}
