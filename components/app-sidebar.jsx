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
  SidebarSeparator,
  useSidebar,
} from "./ui/sidebar";
import BrandLogo from "./BrandLogo";
import ThemeToggle from "./ThemeToggle";
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

function GithubIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

/**
 * 全局侧栏（sidebar-07 折叠分区模式）：
 * Header 品牌 → 导航分组 → 页面专属分组（sidebarExtra）→ Footer（主题/GitHub/版本）。
 */
export default function AppSidebar({ sidebarExtra = null, ...props }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const closeOnMobile = () => setOpenMobile(false);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/" className="no-underline" />}>
              <BrandLogo className="size-7" />
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

        {sidebarExtra}
      </SidebarContent>

      <SidebarFooter className="gap-0 p-0">
        <SidebarSeparator />
        <SidebarMenu className="px-2 py-2">
          <SidebarMenuItem>
            <div
              className={cn(
                "flex w-full items-center justify-between gap-2",
                "group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1"
              )}
            >
              <div
                className={cn(
                  "flex min-w-0 items-center gap-1.5",
                  "group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:gap-1"
                )}
              >
                <SidebarMenuButton
                  tooltip="GitHub 源码"
                  className="size-8 shrink-0 text-muted-foreground hover:text-sidebar-accent-foreground"
                  render={
                    <a
                      href="https://github.com/zephyr110/financial-signal"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="no-underline"
                      aria-label="GitHub 源码"
                    />
                  }
                >
                  <GithubIcon />
                  <span className="sr-only">GitHub</span>
                </SidebarMenuButton>
                <span
                  className={cn(
                    "rounded-md bg-sidebar-accent/50 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground",
                    "group-data-[collapsible=icon]:hidden"
                  )}
                >
                  v2.0.0
                </span>
              </div>
              <ThemeToggle />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
