import { useState } from "react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { label: "24h", hours: 24 },
  { label: "周", hours: 168 },
  { label: "月", hours: 720 },
  { label: "年", hours: 8760 },
  { label: "自定义", hours: -1 },
];

export default function TimeRangeFilter({ value, onChange }) {
  const [customOpen, setCustomOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const activePreset = PRESETS.find((p) => p.hours === value);

  const handlePreset = (hours) => {
    if (hours === -1) {
      setCustomOpen(!customOpen);
      return;
    }
    setCustomOpen(false);
    onChange(hours);
  };

  const handleCustomApply = () => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffHours = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60)));
      onChange(diffHours);
      setCustomOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] sm:text-xs text-muted-foreground shrink-0">
        时间跨度：
      </span>
      <div className="flex items-center gap-1">
        {PRESETS.map(({ label, hours }) => {
          const active = activePreset?.hours === hours;
          return (
            <button
              key={label}
              type="button"
              onClick={() => handlePreset(hours)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium transition-all border",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {customOpen && (
        <div className="flex items-center gap-1.5 w-full sm:w-auto mt-1 sm:mt-0">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-[11px] sm:text-xs bg-card border rounded-md px-2 py-1 text-foreground"
          />
          <span className="text-[11px] text-muted-foreground">—</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-[11px] sm:text-xs bg-card border rounded-md px-2 py-1 text-foreground"
          />
          <button
            type="button"
            onClick={handleCustomApply}
            className="px-2 py-1 rounded-md text-[11px] sm:text-xs font-medium bg-primary text-primary-foreground"
          >
            确定
          </button>
        </div>
      )}
    </div>
  );
}
