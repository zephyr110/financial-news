import { useState, useEffect, useCallback, useRef } from "react";
import Head from "next/head";
import { getArchivedNews } from "../lib/db";
import { fetchLiveNews } from "../lib/archive";
import NewsList from "../components/NewsList";
import SiteHeader from "../components/SiteHeader";
import ErrorBanner from "../components/ErrorBanner";
import EmptyState from "../components/EmptyState";
import { RefreshCw } from "lucide-react";

const PULL_THRESHOLD = 56;

function mapArchiveRows(rows) {
  return rows.map((row) => ({
    id: row.id,
    rich_text: row.content,
    published_at: row.published_at,
    source: row.source,
    title: row.title,
  }));
}

export default function Home({ items: ssgItems, error: ssgError }) {
  const [items, setItems] = useState(ssgItems);
  const [error, setError] = useState(ssgError ?? null);
  const [fetching, setFetching] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [mounted, setMounted] = useState(false);

  // ---- pull-to-refresh ----
  const [pullDist, setPullDist] = useState(0);
  const pullDistRef = useRef(0);
  const fetchingRef = useRef(false);
  const touchY0 = useRef(0);
  const pulling = useRef(false);

  useEffect(() => {
    fetchingRef.current = fetching;
  }, [fetching]);

  const abortRef = useRef(null);

  const doRefresh = useCallback(async () => {
    if (fetchingRef.current) return;
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

  // Set mounted flag and initial timestamp client-side only (avoid hydration mismatch)
  useEffect(() => {
    setMounted(true);
    if (ssgItems && ssgItems.length > 0) {
      setLastUpdated(new Date());
    }
  }, [ssgItems]);

  // Only auto-refresh if SSG returned no data (cold start)
  useEffect(() => {
    if (!ssgItems || ssgItems.length === 0) {
      doRefresh();
    }
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [doRefresh, ssgItems]);

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
        <title>财经信号 — 实时快讯 · AI 信号识别</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="AI 驱动的财经信号识别引擎，自动筛选政策、行业、公司关键信号"
        />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Recent Entries"
          href="/api/rss.xml"
        />
      </Head>

      <SiteHeader
        onRefresh={doRefresh}
        refreshing={fetching}
        lastUpdated={lastUpdated}
      />

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
          style={{ height: pullDist, opacity: pullProgress }}
        >
          <RefreshCw
            className={`h-4 w-4 text-muted-foreground ${fetching ? "animate-spin" : ""}`}
            style={{
              transform: !fetching && pullDist > 0
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

        <div className="mx-auto max-w-[720px] lg:max-w-[960px] xl:max-w-[1200px] px-4 sm:px-6 pb-12">
          {/* Page intro */}
          <div className="pt-8 pb-5">
            <h2 className="text-[13px] sm:text-sm text-muted-foreground font-normal">
              7×24 全球财经快讯，AI 智能筛选高价值信号
            </h2>
            {lastUpdated && (
              <p className="mt-1 text-[11px] text-muted-foreground/60">
                更新于{" "}
                {lastUpdated.toLocaleTimeString("zh-CN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </p>
            )}
          </div>

          <ErrorBanner message={error} />

          {Array.isArray(items) && items.length > 0 ? (
            <NewsList items={items} />
          ) : (
            !error && <EmptyState />
          )}
        </div>
      </div>
    </>
  );
}

export async function getStaticProps() {
  try {
    const rows = await getArchivedNews({ daysBack: 7, limit: 500 });
    let items = mapArchiveRows(rows);

    // Always supplement with live data + dedup to avoid duplicates
    try {
      const liveItems = await fetchLiveNews();
      if (liveItems.length > 0) {
        const seen = new Set<string>();
        items = [...liveItems, ...items].filter(item => {
          const key = (item.rich_text || '').slice(0, 80).trim();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    } catch (liveErr) {
      console.error('[index] Live supplement failed:', liveErr.message);
    }

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
