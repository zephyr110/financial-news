import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Newspaper, BarChart3, RefreshCw } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "快讯", icon: Newspaper },
  { href: "/analysis", label: "信号", icon: BarChart3 },
];

export default function SiteHeader({ onRefresh, refreshing, lastUpdated }) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // check initial state
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-200",
        scrolled
          ? "bg-background/80 backdrop-blur-md border-b shadow-sm"
          : "bg-background"
      )}
    >
      <div className="mx-auto max-w-[720px] lg:max-w-[960px] xl:max-w-[1200px] px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Left: Logo + Brand */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 no-underline">
            <img
              src="/favicon.svg"
              alt="Logo"
              className="h-7 w-7 sm:h-8 sm:w-8"
            />
            <div className="hidden sm:block">
              <span className="text-base sm:text-lg font-semibold text-foreground tracking-tight">
                财经信号
              </span>
              <span className="ml-2 text-[11px] sm:text-xs text-muted-foreground">
                实时快讯 · AI 信号识别
              </span>
            </div>
            <span className="sm:hidden text-base font-semibold text-foreground tracking-tight">
              财经信号
            </span>
          </Link>

          {/* Center: Navigation Tabs */}
          <nav className="flex items-center gap-0.5">
            {TABS.map(({ href, label, icon: Icon }) => {
              const active = router.pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right: Refresh + Theme */}
          <div className="flex items-center gap-0.5 shrink-0">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={refreshing}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="刷新数据"
              >
                <RefreshCw
                  className={cn("h-4 w-4", refreshing && "animate-spin")}
                />
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
