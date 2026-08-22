import { createContext, useContext, useRef } from "react";
import { SidebarInset, SidebarProvider } from "./ui/sidebar";
import AppSidebar from "./app-sidebar";
import AppTopbar from "./app-topbar";

// 内容滚动容器 ref——首页下拉刷新读 scrollTop、区块导航 IntersectionObserver 传 root
const AppShellScrollContext = createContext(null);
export function useAppShellScroll() {
  return useContext(AppShellScrollContext);
}

/**
 * 全局 App 壳（shadcn sidebar-07 模式）：
 * 左侧全局侧栏（导航分组 + 页面专属分组）+ 右侧列（顶栏 + 内容滚动区）。
 * 滚动容器内为 mx-auto 内容列，由各页面自行排布。
 * scrollable=false 时（agent 页）滚动容器改为 flex-col 透传，页面管理自身滚动。
 */
export default function AppShell({
  title,
  subtitle = null,
  actions = null,
  sidebarExtra = null,
  scrollable = true,
  children,
}) {
  const scrollRef = useRef(null);
  return (
    <SidebarProvider className="flex h-dvh min-h-0 w-full overflow-hidden">
      <AppSidebar sidebarExtra={sidebarExtra} />
      <SidebarInset className="min-w-0 flex-1 overflow-hidden">
        <AppTopbar title={title} subtitle={subtitle} actions={actions} />
        <AppShellScrollContext.Provider value={scrollRef}>
          {scrollable ? (
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-none">
              {children}
            </div>
          ) : (
            <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col">
              {children}
            </div>
          )}
        </AppShellScrollContext.Provider>
      </SidebarInset>
    </SidebarProvider>
  );
}
