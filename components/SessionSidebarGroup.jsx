import { useRef, useState } from "react";
import { Search, MessageSquarePlus, Trash2 } from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
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
 * 搜索过滤 → 会话列表（删除二次确认）→ 新对话入口。
 * icon rail 折叠时隐藏搜索/列表，保留新对话 icon 按钮（tooltip 提示）。
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

  // 移动端选择会话后关闭抽屉（桌面端无副作用）
  const closeOnMobile = () => setOpenMobile(false);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? sessions.filter((s) => (s.title ?? "").toLowerCase().includes(q))
    : sessions;

  // 删除二次确认：点击垃圾桶进入确认态（红色），再点才真正删除；3 秒不操作还原
  const [confirmingId, setConfirmingId] = useState(null);
  const confirmTimer = useRef(null);
  const armDelete = (id) => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmingId(id);
    confirmTimer.current = setTimeout(() => setConfirmingId(null), 3000);
  };

  return (
    <SidebarGroup className="min-h-0 flex-1">
      <SidebarGroupLabel>历史会话</SidebarGroupLabel>

      {/* 折叠 icon rail 时隐藏搜索与列表（新对话入口保留） */}
      <div className="flex min-h-0 flex-1 flex-col group-data-[collapsible=icon]:hidden">
        <div className="relative mb-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <SidebarInput
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="搜索会话…"
            className="pl-8 text-xs"
          />
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

      <SidebarSeparator className="group-data-[collapsible=icon]:hidden" />

      <SidebarMenu className="pt-1">
        <SidebarMenuItem>
          <SidebarMenuButton
            variant="outline"
            tooltip="新对话"
            onClick={() => {
              onNew();
              closeOnMobile();
            }}
            className={cn(
              "font-medium text-sidebar-foreground shadow-none",
              "hover:bg-sidebar-primary/10 hover:text-sidebar-primary",
              "[&_svg]:text-sidebar-primary"
            )}
          >
            <MessageSquarePlus />
            <span>新对话</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
