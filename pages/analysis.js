import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import AnalysisOverview from "../components/AnalysisOverview";
import SignalTimeline from "../components/SignalTimeline";
import ErrorBanner from "../components/ErrorBanner";
import NavTabs from "../components/NavTabs";
import { RefreshCw } from "lucide-react";

export default function Analysis({ stats: ssgStats, items: ssgItems, error: ssgError }) {
  const [items, setItems] = useState(ssgItems);
  const [stats, setStats] = useState(ssgStats);
  const [error, setError] = useState(ssgError ?? null);
  const [fetching, setFetching] = useState(false);

  const doRefresh = useCallback(async () => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/analysis?hoursBack=24");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
      setStats(data.stats || {});
    } catch (e) {
      console.error("Analysis refresh failed:", e);
      setError("数据更新失败，请稍后重试");
    } finally {
      setFetching(false);
    }
  }, []);

  // Refresh on mount
  useEffect(() => {
    const controller = new AbortController();
    doRefresh();
    return () => controller.abort();
  }, [doRefresh]);

  return (
    <>
      <Head>
        <title>分析面板 — Financial News</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="政策-行业影响分析引擎" />
      </Head>

      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-[720px] lg:max-w-[960px] xl:max-w-[1200px] px-4 sm:px-6">
          {/* Header */}
          <header className="flex items-center justify-between pt-8 pb-6">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-foreground">
                分析面板
              </h1>
              <p className="mt-1 text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
                AI 驱动 · 政策-行业信号识别
              </p>
            </div>
            <button
              onClick={doRefresh}
              disabled={fetching}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              title="刷新"
            >
              <RefreshCw className={`h-4 w-4 ${fetching ? "animate-spin" : ""}`} />
            </button>
          </header>

          <hr className="border-border mb-6" />

          <NavTabs />

          <ErrorBanner message={error} />

          {/* Overview stats */}
          {stats && <AnalysisOverview stats={stats} />}

          {/* Signal timeline */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">信号时间线</h2>
            <SignalTimeline items={items} />
          </section>

          <footer className="py-10 text-center text-[11px] sm:text-xs lg:text-sm text-muted-foreground">
            <p>
              AI 分析仅供参考，不构成投资建议 · Powered by DeepSeek
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}

export async function getStaticProps() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/analysis?hoursBack=24`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      props: {
        stats: data.stats || { total_signals: 0, significant_count: 0, max_score: 0, critical_count: 0 },
        items: data.items || [],
        error: null,
      },
      revalidate: 600,
    };
  } catch (e) {
    console.error("Analysis getStaticProps error:", e);
    return {
      props: {
        stats: { total_signals: 0, significant_count: 0, max_score: 0, critical_count: 0 },
        items: [],
        error: "暂时无法获取分析数据，请稍后刷新",
      },
      revalidate: 60,
    };
  }
}
