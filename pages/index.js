import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import { fetchNews } from "../lib/fetchNews";
import NewsList from "../components/NewsList";
import ThemeToggle from "../components/ThemeToggle";
import ErrorBanner from "../components/ErrorBanner";
import EmptyState from "../components/EmptyState";
import { RefreshCw } from "lucide-react";

const PULL_THRESHOLD = 56;

export default function Home({ items: ssgItems, error: ssgError }) {
  const [items, setItems] = useState(ssgItems);
  const [error, setError] = useState(ssgError ?? null);
  const [fetching, setFetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ---- pull-to-refresh (ref-based to avoid stale closures) ----
  const [pullDist, setPullDist] = useState(0);
  const pullDistRef = useRef(0);
  const fetchingRef = useRef(false);
  const touchY0 = useRef(0);
  const pulling = useRef(false);

  // keep fetchingRef in sync so touch handlers can read it without deps
  useEffect(() => {
    fetchingRef.current = fetching;
  }, [fetching]);

  const abortRef = useRef(null);

  const doRefresh = useCallback(async () => {
    if (fetchingRef.current) return;
    // abort any in-flight request from a previous unmount/remount cycle
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setFetching(true);
    fetchingRef.current = true;
    setError(null);
    try {
      const res = await fetch("/api/news", { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
      setLastUpdated(new Date());
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error("Refresh failed:", e);
      setError("数据更新失败，请稍后重试");
    } finally {
      setFetching(false);
      fetchingRef.current = false;
      setPullDist(0);
      pullDistRef.current = 0;
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, []);

  // 页面加载时触发一次数据更新
  useEffect(() => {
    doRefresh();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [doRefresh]);

  // ---- touch handlers ----
  const onTouchStart = useCallback((e) => {
    pulling.current = false;
    if (window.scrollY === 0 && !fetchingRef.current) {
      touchY0.current = e.touches[0].clientY;
      pulling.current = true;
    }
  }, []);

  const onTouchMove = useCallback((e) => {
    if (!pulling.current) return;
    const dy = e.touches[0].clientY - touchY0.current;
    if (dy > 0) {
      e.preventDefault();
      const d = Math.min(dy * 0.45, 120);
      pullDistRef.current = d;
      setPullDist(d);
    } else {
      pullDistRef.current = 0;
      setPullDist(0);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    pulling.current = false;
    if (pullDistRef.current >= PULL_THRESHOLD && !fetchingRef.current) {
      doRefresh();
    } else {
      setPullDist(0);
      pullDistRef.current = 0;
    }
  }, [doRefresh]);

  const onTouchCancel = useCallback(() => {
    pulling.current = false;
    setPullDist(0);
    pullDistRef.current = 0;
  }, []);

  const pullProgress = Math.min(pullDist / PULL_THRESHOLD, 1);

  return (
    <>
      <Head>
        <title>Financial News — 全球实时财经新闻</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="新浪全球实时财经新闻直播" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Recent Entries"
          href="/api/rss.xml"
        />
      </Head>

      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        className="min-h-screen bg-background"
        style={{ overscrollBehavior: "none" }}
      >
        {/* Pull-to-refresh indicator */}
        <div
          className="flex items-center justify-center gap-2 overflow-hidden"
          style={{
            height: pullDist,
            opacity: pullProgress,
          }}
        >
          <RefreshCw
            className={`h-4 w-4 text-muted-foreground ${fetching ? "animate-spin" : ""}`}
            style={{
              transform:
                !fetching && pullDist > 0
                  ? `rotate(${pullProgress * 360}deg)`
                  : undefined,
            }}
          />
          <span className="text-xs text-muted-foreground">
            {fetching
              ? "更新中…"
              : pullDist >= PULL_THRESHOLD
                ? "释放刷新"
                : "下拉刷新"}
          </span>
        </div>

        <div className="mx-auto max-w-[720px] lg:max-w-[960px] xl:max-w-[1200px] px-4 sm:px-6">
          {/* Header */}
          <header className="flex items-center justify-between pt-8 pb-6">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
                全球实时财经新闻
              </h1>
              <p className="mt-1 text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
                新浪财经 7×24 直播 · 实时更新
                {lastUpdated && (
                  <span className="ml-2">
                    · 更新于{" "}
                    {lastUpdated.toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={doRefresh}
                disabled={fetching}
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                title="刷新"
              >
                <RefreshCw
                  className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`}
                />
              </button>
              <ThemeToggle />
            </div>
          </header>

          <hr className="border-border mb-6" />

          <ErrorBanner message={error} />

          {Array.isArray(items) && items.length > 0 ? (
            <NewsList items={items} />
          ) : (
            !error && <EmptyState />
          )}

          <footer className="py-10 text-center text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
            <p>
              Powered by Financial News · 数据来源：{" "}
              <a
                href="https://zhibo.sina.com.cn"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                新浪财经
              </a>
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}

export async function getStaticProps() {
  try {
    const items = await fetchNews();
    return {
      props: { items, error: null },
      revalidate: 1800,
    };
  } catch (e) {
    console.error("Failed to fetch news:", e);
    return {
      props: { items: [], error: "暂时无法获取最新新闻，请稍后刷新页面" },
      revalidate: 60,
    };
  }
}
