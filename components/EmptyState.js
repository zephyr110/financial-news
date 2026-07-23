import { Newspaper } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
      <Newspaper className="h-12 w-12 mb-4 opacity-40" />
      <p className="text-[13px] sm:text-sm lg:text-base">暂无新闻数据</p>
      <p className="text-[11px] sm:text-xs lg:text-sm mt-1 opacity-60">请稍后刷新页面</p>
    </div>
  );
}
