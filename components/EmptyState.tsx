import { Radio, RefreshCw } from "lucide-react";
import { buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";

export default function EmptyState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50 mb-4">
        <Radio className="h-8 w-8 opacity-50" />
      </span>
      <p className="text-[13px] sm:text-sm lg:text-base font-medium">暂无快讯数据</p>
      <p className="text-[11px] sm:text-xs lg:text-sm mt-1 opacity-60">
        数据正在采集中，稍后自动更新
      </p>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-5")}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          立即刷新
        </button>
      )}
    </div>
  );
}
