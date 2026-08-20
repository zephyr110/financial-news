import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ContentNavItem {
  id: string;
  label: string;
}

/**
 * Sticky 内容导航条：长页面快速定位内容块（scroll-spy 高亮 + 平滑滚动）。
 * 优于纯锚点——持续可见 + 当前位置感知；移动端横向滚动。
 * 使用前：目标区块需有 id，并加 scroll-mt-* 避开 sticky 高度（header 56 + nav 40 ≈ 96px）。
 */
export default function ContentNav({
  items,
  className,
}: {
  items: ContentNavItem[];
  className?: string;
}) {
  const [active, setActive] = useState<string | null>(null);

  // 依赖 key 稳定 observer（items 数组每次 render 都是新引用）
  const itemKey = items.map((i) => i.id).join(",");

  useEffect(() => {
    const sections = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) {
      setActive(null);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // 取视口内最靠上方的区块为当前定位
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      // 顶部留出 header+nav 高度，底部留 60% 触发区
      { rootMargin: "-88px 0px -60% 0px", threshold: 0 }
    );
    sections.forEach((s) => observer.observe(s));

    // 初始定位：无可见区块时高亮第一个
    setActive((prev) => prev ?? items[0]?.id ?? null);

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemKey]);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="页面内容导航"
      className={cn(
        "sticky top-14 z-40 border-b bg-background/95 backdrop-blur-md",
        className
      )}
    >
      <div className="mx-auto max-w-[720px] lg:max-w-[960px] px-4 sm:px-6">
        <div className="flex items-center gap-1 overflow-x-auto py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollTo(item.id)}
              aria-current={active === item.id ? "true" : undefined}
              className={cn(
                "shrink-0 rounded-md px-2.5 h-7 text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active === item.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
