import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { cn } from "@/lib/utils";

export interface ContentNavItem {
  id: string;
  label: string;
}

/**
 * Scroll-spy：监听区块可见性，返回当前活动区块 id。
 * AppShell 全局侧栏（SectionNavGroup）使用；ContentNav（移动端 chips 条）曾共用。
 * root 传入 AppShell 内容滚动容器；默认视口。
 * rootMargin 默认 -56px：顶栏 h-14 高度（原 -88px 假设 header+chips，两者已随布局重构移除）。
 *
 * 返回 { active, setActive }：setActive 供区块导航点击时乐观设置高亮——
 * IO 只在交集状态变化时回调，点击「已在视口内部分可见」的区块不会触发，
 * 需先手动置位，滚动过程中的 IO 回调再校正（C 段验证发现）。
 */
export function useSectionSpy(
  items: ContentNavItem[],
  options?: { root?: HTMLElement | null; rootMargin?: string }
): { active: string | null; setActive: Dispatch<SetStateAction<string | null>> } {
  const [active, setActive] = useState<string | null>(null);
  const { root = null, rootMargin = "-56px 0px -60% 0px" } = options ?? {};

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
        // 取滚动容器内最靠上方的区块为当前定位
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      // 顶部留出顶栏高度，底部留 60% 触发区
      { root, rootMargin, threshold: 0 }
    );
    sections.forEach((s) => observer.observe(s));

    // 初始定位：无可见区块时高亮第一个
    setActive((prev) => prev ?? items[0]?.id ?? null);

    return () => observer.disconnect();
  }, [itemKey, root, rootMargin]);

  return { active, setActive };
}

/**
 * Sticky 内容导航条：长页面快速定位内容块（scroll-spy 高亮 + 平滑滚动）。
 * 全局侧栏重构后已无使用方（区块导航由侧栏 SectionNavGroup 承担），仅保留导出。
 */
export default function ContentNav({
  items,
  className,
}: {
  items: ContentNavItem[];
  className?: string;
}) {
  const { active } = useSectionSpy(items);

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
