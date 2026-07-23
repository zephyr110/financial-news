import { Newspaper } from "lucide-react";

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-[var(--muted)]">
      <Newspaper className="h-12 w-12 mb-4 opacity-40" />
      <p className="text-sm">暂无新闻数据</p>
      <p className="text-xs mt-1 opacity-60">请稍后刷新页面</p>
    </div>
  );
}
