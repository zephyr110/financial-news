import { useEffect, useRef, useState } from "react";
import { Search, MessageSquarePlus, Trash2 } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "./ui/sidebar";
import { cn } from "@/lib/utils";

/** SQLite datetime('now')（UTC）→ 相对时间 */
function relTime(iso) {
  if (!iso) return "";
  const t = new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

/**
 * 研究助手页侧栏分组：历史会话（sidebar-07 折叠分区模式）。
 * 顶栏：新对话 + 可展开搜索（默认仅图标）；下方会话列表。
 * icon rail 折叠时仅保留新对话入口。
 */
export default function SessionSidebarGroup({
  sessions,
  currentId,
  query,
  onQuery,
  onSelect,
  onNew,
  onDelete,
}) {
  const { setOpenMobile } = useSidebar();
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);

  const closeOnMobile = () => setOpenMobile(false);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? sessions.filter((s) => (s.title ?? "").toLowerCase().includes(q))
    : sessions;

  const [confirmingId, setConfirmingId] = useState(null);
  const confirmTimer = useRef(null);
  const armDelete = (id) => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmingId(id);
    confirmTimer.current = setTimeout(() => setConfirmingId(null), 3000);
  };

  const openSearch = () => setSearchOpen(true);

  const closeSearch = () => {
    if (!query.trim()) setSearchOpen(false);
  };

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  // 有搜索词时保持展开，避免输入后误触收起看不见关键词
  useEffect(() => {
    if (query.trim()) setSearchOpen(true);
  }, [query]);

  const handleNew = () => {
    onNew();
    closeOnMobile();
  };

  return (
    <SidebarGroup className="min-h-0 flex-1">
      <SidebarGroupLabel>历史会话</SidebarGroupLabel>

      {/* 展开态：新对话 + 可展开搜索 + 列表 */}
      <div className="flex min-h-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
        <div className="relative mb-2 flex h-8 items-center gap-1">
          <button
            type="button"
            onClick={handleNew}
            aria-hidden={searchOpen}
            tabIndex={searchOpen ? -1 : 0}
            className={cn(
              "flex h-8 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-sidebar-border px-2 text-xs font-medium",
              "text-sidebar-foreground transition-opacity",
              "hover:bg-sidebar-primary/10 hover:text-sidebar-primary",
              "[&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-sidebar-primary",
              searchOpen && "pointer-events-none opacity-0"
            )}
          >
            <MessageSquarePlus />
            <span className="truncate">新对话</span>
          </button>

          {!searchOpen && (
            <button
              type="button"
              onClick={openSearch}
              className={cn(
                "inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground",
                "transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              )}
              aria-label="搜索会话"
            >
              <Search className="size-4" />
            </button>
          )}

          {searchOpen && (
            <div className="absolute inset-0 z-10 flex items-center">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <SidebarInput
                ref={searchInputRef}
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                onBlur={closeSearch}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    if (query.trim()) onQuery("");
                    else setSearchOpen(false);
                    searchInputRef.current?.blur();
                  }
                }}
                placeholder="搜索会话…"
                className="h-8 w-full pl-8 text-xs"
                aria-label="搜索会话"
              />
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarMenu>
            {filtered.length === 0 ? (
              <SidebarMenuItem>
                <div className="py-10 text-center text-xs text-muted-foreground">
                  {sessions.length === 0 ? "暂无历史会话" : "无匹配会话"}
                </div>
              </SidebarMenuItem>
            ) : (
              filtered.map((s) => {
                const active = s.id === currentId;
                const confirming = confirmingId === s.id;
                return (
                  <SidebarMenuItem key={s.id}>
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={s.title || "未命名会话"}
                      onClick={() => {
                        onSelect(s.id);
                        closeOnMobile();
                      }}
                      className="h-auto items-start py-1.5"
                    >
                      <div className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-sm",
                            active ? "font-medium" : "text-foreground/90"
                          )}
                        >
                          {s.title || "未命名会话"}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {relTime(s.updated_at)}
                        </span>
                      </div>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      onClick={() => (confirming ? onDelete(s.id) : armDelete(s.id))}
                      aria-label={confirming ? `确认删除会话 ${s.title || ""}` : `删除会话 ${s.title || ""}`}
                      title={confirming ? "再次点击确认删除" : "删除会话"}
                      className={cn(
                        confirming
                          ? "bg-destructive/10 text-destructive opacity-100"
                          : "opacity-0 group-hover/menu-item:opacity-100 focus-visible:opacity-100"
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </SidebarMenuAction>
                  </SidebarMenuItem>
                );
              })
            )}
          </SidebarMenu>
        </div>
      </div>

      {/* 折叠 icon rail：仅新对话 */}
      <SidebarMenu className="hidden group-data-[collapsible=icon]:flex">
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="新对话" onClick={handleNew}>
            <MessageSquarePlus className="text-sidebar-primary" />
            <span>新对话</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
