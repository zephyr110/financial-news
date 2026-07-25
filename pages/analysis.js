import { useState, useEffect, useCallback, useMemo } from "react";
import Head from "next/head";
import AnalysisOverview from "../components/AnalysisOverview";
import ScoreFilter from "../components/ScoreFilter";
import IndustryBarChart from "../components/IndustryBarChart";
import IndustryTrendChart from "../components/IndustryTrendChart";
import CategoryDonutChart from "../components/CategoryDonutChart";
import TimeRangeFilter from "../components/TimeRangeFilter";
import SignalTimeline from "../components/SignalTimeline";
import SiteHeader from "../components/SiteHeader";
import ErrorBanner from "../components/ErrorBanner";
import { getAnalyzedNews, getAnalysisStats, getIndustryHeatmap, getIndustryTrend } from "../lib/db.js";
import { safeParse } from "../lib/utils.js";

function applyFilters(allItems, cardFilter, scoreFilter, maxScore) {
  let filtered = allItems;
  if (cardFilter === 'significant') {
    filtered = filtered.filter(item => item.signal_score === 4);
  } else if (cardFilter === 'critical') {
    filtered = filtered.filter(item => item.signal_score === 5);
  } else if (cardFilter === 'max') {
    filtered = filtered.filter(item => item.signal_score === maxScore);
  }
  if (scoreFilter) {
    filtered = filtered.filter(item => item.signal_score === scoreFilter);
  }
  return filtered;
}

export default function Analysis({ stats: ssgStats, items: ssgItems, heatmap: ssgHeatmap, trend: ssgTrend, error: ssgError }) {
  const [items, setItems] = useState(ssgItems);
  const [stats, setStats] = useState(ssgStats);
  const [heatmap, setHeatmap] = useState(ssgHeatmap || []);
  const [trend, setTrend] = useState(ssgTrend || []);
  const [error, setError] = useState(ssgError ?? null);
  const [fetching, setFetching] = useState(false);
  const [cardFilter, setCardFilter] = useState(null);
  const [scoreFilter, setScoreFilter] = useState(null);
  const [trendHours, setTrendHours] = useState(168); // default: 周

  const doRefresh = useCallback(async (signal) => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`/api/analysis?hoursBack=24&trendHours=${trendHours}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
      setStats(data.stats || {});
      setHeatmap(data.heatmap || []);
      setTrend(data.trend || []);
    } catch (e) {
      if (e.name === "AbortError") return;
      console.error("Analysis refresh failed:", e);
      setError("数据更新失败，请稍后重试");
    } finally {
      setFetching(false);
    }
  }, [trendHours]);

  useEffect(() => {
    const controller = new AbortController();
    doRefresh(controller.signal);
    return () => controller.abort();
  }, [doRefresh]);

  const filteredItems = useMemo(
    () => applyFilters(items, cardFilter, scoreFilter, stats?.max_score || 0),
    [items, cardFilter, scoreFilter, stats?.max_score]
  );

  const hasData = items.length > 0;

  return (
    <>
      <Head>
        <title>信号分析 — 财经信号</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="AI 驱动的财经信号识别引擎 — 政策、行业、公司信号强度分析" />
      </Head>

      <SiteHeader onRefresh={() => doRefresh()} refreshing={fetching} />

      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-[720px] lg:max-w-[960px] xl:max-w-[1200px] px-4 sm:px-6 pb-12">
          <div className="pt-8 pb-5">
            <h2 className="text-[13px] sm:text-sm text-muted-foreground font-normal">
              政策 · 行业 · 公司 — AI 智能分析，一目了然
            </h2>
          </div>

          <ErrorBanner message={error} />

          <AnalysisOverview
            stats={stats}
            items={items}
            loading={fetching && items.length === 0}
            filter={cardFilter}
            onFilterChange={setCardFilter}
          />

          <ScoreFilter value={scoreFilter} onChange={setScoreFilter} />

          {/* Charts: 2-col grid + full-width trend */}
          {hasData && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-card border rounded-xl p-4 sm:p-5">
                  <h3 className="text-xs sm:text-sm font-medium text-foreground mb-3">
                    行业信号分布
                  </h3>
                  <IndustryBarChart data={heatmap} />
                </div>
                <div className="bg-card border rounded-xl p-4 sm:p-5">
                  <h3 className="text-xs sm:text-sm font-medium text-foreground mb-3">
                    信号分类占比
                  </h3>
                  <CategoryDonutChart items={items} />
                </div>
              </div>

              {trend.length >= 2 && (
                <div className="bg-card border rounded-xl p-4 sm:p-5 mb-6">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <h3 className="text-xs sm:text-sm font-medium text-foreground">
                      行业热度趋势
                    </h3>
                    <TimeRangeFilter value={trendHours} onChange={setTrendHours} />
                  </div>
                  <IndustryTrendChart data={trend} />
                </div>
              )}
            </>
          )}

          <h3 className="text-xs sm:text-sm font-medium text-foreground mb-3">
            信号时间线 {filteredItems.length > 0 && `(${filteredItems.length})`}
          </h3>
          <SignalTimeline items={filteredItems} />
        </div>
      </div>
    </>
  );
}

export async function getStaticProps() {
  try {
    const [news, stats, heatmap, trend] = await Promise.all([
      getAnalyzedNews({ minScore: 1, hoursBack: 24, limit: 200 }),
      getAnalysisStats(24),
      getIndustryHeatmap(24),
      getIndustryTrend(24),
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
        heatmap: heatmap || [],
        trend: trend || [],
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
        heatmap: [],
        trend: [],
        error: "暂时无法获取分析数据，请稍后刷新",
      },
      revalidate: 60,
    };
  }
}
