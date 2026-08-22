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
import BrandLogo from "./BrandLogo";
import AvatarMenu from "./avatar-menu";

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
 * Header 品牌 → 导航分组 → 页面专属分组（sidebarExtra）→ Footer（头像菜单：设置/主题/GitHub/退出）。
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
        <SidebarMenu className="px-2 py-2">
          <AvatarMenu />
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
