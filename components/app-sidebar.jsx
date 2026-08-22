import Link from "next/link";
import { useRouter } from "next/router";
import { Newspaper, TrendingUp, Bot } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "./ui/sidebar";
import ThemeToggle from "./ThemeToggle";
import { buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "新闻快讯", icon: Newspaper, match: (p) => p === "/" },
  {
    href: "/analysis",
    label: "信号分析",
    icon: TrendingUp,
    match: (p) =>
      p === "/analysis" || p.startsWith("/signal/") || p.startsWith("/thread/") || p === "/analytics/value",
  },
  { href: "/agent", label: "研究助手", icon: Bot, match: (p) => p === "/agent" },
];

/**
 * 全局侧栏（sidebar-07 折叠分区模式）：
 * Header 品牌 → 导航分组 → 页面专属分组（sidebarExtra）→ Footer（主题/GitHub/版本）。
 * collapsible="icon"：桌面折叠为 48px icon rail（label 由 overflow-hidden 裁切、tooltip 展示）；
 * 移动端自动切换为 offcanvas Sheet。
 */
export default function AppSidebar({ sidebarExtra = null, ...props }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  // 移动端点击导航后关闭抽屉（桌面端无副作用）
  const closeOnMobile = () => setOpenMobile(false);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" className="no-underline" />}>
              <img src="/favicon.svg" alt="财经信号" className="size-7 shrink-0" />
              <span className="truncate text-base font-semibold tracking-tight text-sidebar-foreground">
                财经信号
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-1">
        <SidebarGroup className="gap-1">
          <SidebarGroupLabel className="mb-1">导航</SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = item.match(router.pathname);
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className="no-underline"
                      />
                    }
                    isActive={active}
                    tooltip={item.label}
                    onClick={closeOnMobile}
                    // 交互色：激活项主色 tint（! 覆盖组件默认 accent），hover 保持 accent
                    className="py-2.5 data-active:!bg-sidebar-primary/10 data-active:!text-sidebar-primary"
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>

        {/* 页面专属分组：analysis→页面内容区块导航；agent→历史会话 */}
        {sidebarExtra}
      </SidebarContent>

      <SidebarFooter>
        {/* 展开：GitHub+版本 靠左、主题切换 靠右，border-t 分隔；收起（icon rail）：仅主题按钮居中 */}
        <div className="flex items-center justify-between gap-1 border-t px-3 pb-3 pt-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:border-t-0 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pb-2">
          <div className="flex items-center gap-0.5 group-data-[collapsible=icon]:hidden">
            <a
              href="https://github.com/zephyr110/financial-news"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "size-8 text-muted-foreground no-underline hover:text-foreground"
              )}
              title="GitHub 源码"
              aria-label="GitHub 源码"
            >
              {/* lucide 已移除品牌图标（Github），沿用 SiteHeader 原 inline SVG */}
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </a>
            {/* 版本号与 package.json 保持一致（仅展开态显示） */}
            <span className="text-[10px] text-muted-foreground">v2.0.0</span>
          </div>
          <ThemeToggle />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
