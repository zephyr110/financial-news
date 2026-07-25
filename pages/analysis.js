import { useState, useEffect, useCallback, useMemo } from "react";
import Head from "next/head";
import AnalysisOverview from "../components/AnalysisOverview";
import ScoreFilter from "../components/ScoreFilter";
import SignalTimeline from "../components/SignalTimeline";
import SiteHeader from "../components/SiteHeader";
import ErrorBanner from "../components/ErrorBanner";
import { getAnalyzedNews, getAnalysisStats } from "../lib/db.js";
import { safeParse } from "../lib/utils.js";

// Apply combined filters to items array
function applyFilters(allItems, cardFilter, scoreFilter, maxScore) {
  let filtered = allItems;

  if (cardFilter === 'significant') {
    filtered = filtered.filter(item => item.signal_score >= 3);
  } else if (cardFilter === 'critical') {
    filtered = filtered.filter(item => item.signal_score >= 4);
  } else if (cardFilter === 'max') {
    filtered = filtered.filter(item => item.signal_score === maxScore);
  }

  if (scoreFilter) {
    filtered = filtered.filter(item => item.signal_score === scoreFilter);
  }

  return filtered;
}

export default function Analysis({ stats: ssgStats, items: ssgItems, error: ssgError }) {
  const [items, setItems] = useState(ssgItems);
  const [stats, setStats] = useState(ssgStats);
  const [error, setError] = useState(ssgError ?? null);
  const [fetching, setFetching] = useState(false);
  const [cardFilter, setCardFilter] = useState(null);   // null | 'significant' | 'max' | 'critical'
  const [scoreFilter, setScoreFilter] = useState(null);  // null | 1-5

  const doRefresh = useCallback(async (signal) => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/analysis?hoursBack=24", { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
      setStats(data.stats || {});
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error("Analysis refresh failed:", e);
      setError("数据更新失败，请稍后重试");
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    doRefresh(controller.signal);
    return () => controller.abort();
  }, [doRefresh]);

  const filteredItems = useMemo(
    () => applyFilters(items, cardFilter, scoreFilter, stats?.max_score || 0),
    [items, cardFilter, scoreFilter, stats?.max_score]
  );

  return (
    <>
      <Head>
        <title>信号分析 — 财经信号</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="AI 驱动的财经信号识别引擎 — 政策、行业、公司信号强度分析" />
      </Head>

      <SiteHeader onRefresh={() => doRefresh()} refreshing={fetching} />

      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-[720px] lg:max-w-[960px] xl:max-w-[1200px] px-4 sm:px-6 pb-10">
          {/* Page intro */}
          <div className="pt-6 pb-4">
            <h2 className="text-[13px] sm:text-sm text-muted-foreground font-normal">
              政策 · 行业 · 公司 — AI 信号强度一目了然
            </h2>
          </div>

          <ErrorBanner message={error} />

          {stats && (
            <AnalysisOverview
              stats={stats}
              filter={cardFilter}
              onFilterChange={setCardFilter}
            />
          )}

          <ScoreFilter value={scoreFilter} onChange={setScoreFilter} />

          <SignalTimeline items={filteredItems} />
        </div>
      </div>
    </>
  );
}

export async function getStaticProps() {
  try {
    const [news, stats] = await Promise.all([
      getAnalyzedNews({ minScore: 1, hoursBack: 24, limit: 200 }),
      getAnalysisStats(24),
    ]);
    const items = news.map((item) => ({
      ...item,
      industries: item.industries ? safeParse(item.industries) : [],
      companies: item.companies ? safeParse(item.companies) : [],
      tags: item.tags ? safeParse(item.tags) : [],
    }));
    return {
      props: {
        stats: stats || { total_signals: 0, significant_count: 0, max_score: 0, critical_count: 0 },
        items: items || [],
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
