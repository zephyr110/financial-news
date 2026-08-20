import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Head from "next/head";
import Link from "next/link";
import AnalysisOverview from "../components/AnalysisOverview";
import ScoreFilter from "../components/ScoreFilter";
import IndustryBarChart from "../components/IndustryBarChart";
import CompanyHeatmap from "../components/CompanyHeatmap";
import IndustryTrendChart from "../components/IndustryTrendChart";
import CategoryDonutChart from "../components/CategoryDonutChart";
import SentimentChart from "../components/SentimentChart";
import EventThreadList from "../components/EventThreadList";
import BacktestPanel from "../components/BacktestPanel";
import TimeRangeFilter from "../components/TimeRangeFilter";
import ClientOnly from "../components/ClientOnly";
import SignalAlert from "../components/SignalAlert";
import SignalTimeline from "../components/SignalTimeline";
import IndustrySelector from "../components/IndustrySelector";
import SiteHeader from "../components/SiteHeader";
import ErrorBanner from "../components/ErrorBanner";
import SearchBar from "../components/SearchBar";
import SignalSearchResults from "../components/SignalSearchResults";
import WatchlistPanel from "../components/WatchlistPanel";
import ContentNav from "../components/ContentNav";
import { getAnalyzedNews, getAnalysisStats, getIndustryHeatmap, getIndustryTrend, getEventThreads } from "../lib/db";
import { useWatchedIndustries } from "../lib/useWatchedIndustries";
import { safeParse } from "../lib/utils";

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

export default function Analysis({ stats: ssgStats, items: ssgItems, heatmap: ssgHeatmap, trend: ssgTrend, threads: ssgThreads, sentimentBreakdown: ssgSentiment, companyHeatmap: ssgCompanyHeatmap, error: ssgError }) {
  const [items, setItems] = useState(ssgItems);
  const [stats, setStats] = useState(ssgStats);
  const [heatmap, setHeatmap] = useState(ssgHeatmap || []);
  const [trend, setTrend] = useState(ssgTrend || []);
  const [threads, setThreads] = useState(ssgThreads || []);
  const [sentimentBreakdown, setSentimentBreakdown] = useState(ssgSentiment || []);
  const [companyHeatmap, setCompanyHeatmap] = useState(ssgCompanyHeatmap || []);
  const [marketToday, setMarketToday] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<"industry" | "company">("industry");
  const [error, setError] = useState(ssgError ?? null);
  const [fetching, setFetching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [cardFilter, setCardFilter] = useState(null);
  const [scoreFilter, setScoreFilter] = useState(null);
  const [trendHours, setTrendHours] = useState(168);
  const { watched, toggle: toggleIndustry, clearAll: clearIndustries, filterByWatched } = useWatchedIndustries();

  // ── Search state ──
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchNextCursor, setSearchNextCursor] = useState<number | null>(null);
  const searchParamsRef = useRef<{ minScore: number; hoursBack: number }>({ minScore: 1, hoursBack: 720 });

  const doRefresh = useCallback(async (signal) => {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`/api/analysis?hoursBack=24&trendHours=${trendHours}`, signal ? { signal } : {});
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems((data.items || []).map(item => ({
        ...item,
        industries: item.industries ? safeParse(item.industries) : [],
        companies: item.companies ? safeParse(item.companies) : [],
        tags: item.tags ? safeParse(item.tags) : [],
      })));
      setStats(data.stats || {});
      setHeatmap(data.heatmap || []);
      setTrend(data.trend || []);
      setThreads(data.threads || []);
      setSentimentBreakdown(data.sentimentBreakdown || []);
      setCompanyHeatmap(data.companyHeatmap || []);
      setMarketToday(data.marketToday || []);
      setNextCursor(data.nextCursor || null);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
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

  // Apply industry filter first, then score/card filters on top
  const watchedItems = useMemo(() => filterByWatched(items), [items, filterByWatched]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      // Score filter uses server-side filtering; card filter uses client-side
      const minScoreParam = scoreFilter || 1;
      const url = `/api/analysis?hoursBack=24&cursor=${nextCursor}&trendHours=${trendHours}&minScore=${minScoreParam}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(prev => [...prev, ...(data.items || []).map((item: any) => ({
        ...item,
        industries: item.industries ? safeParse(item.industries) : [],
        companies: item.companies ? safeParse(item.companies) : [],
        tags: item.tags ? safeParse(item.tags) : [],
      }))]);
      setNextCursor(data.nextCursor || null);
    } catch (e) {
      console.error('Load more failed:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, trendHours]);

  // ── Search handlers ──
  const handleSearch = useCallback(async (params: { query: string; minScore: number; hoursBack: number }) => {
    searchParamsRef.current = { minScore: params.minScore, hoursBack: params.hoursBack };
    setSearchQuery(params.query);
    setIsSearchActive(true);
    setSearchLoading(true);
    setSearchResults([]);

    try {
      const url = `/api/search?q=${encodeURIComponent(params.query)}&minScore=${params.minScore}&hoursBack=${params.hoursBack}&limit=20`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSearchResults(data.items || []);
      setSearchTotal(data.total || 0);
      setSearchNextCursor(data.nextCursor || null);
    } catch (e) {
      console.error("Search failed:", e);
      setSearchResults([]);
      setSearchTotal(0);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchLoadMore = useCallback(async () => {
    if (!searchNextCursor || searchLoadingMore || !searchQuery) return;
    setSearchLoadingMore(true);
    try {
      const { minScore, hoursBack } = searchParamsRef.current;
      const url = `/api/search?q=${encodeURIComponent(searchQuery)}&minScore=${minScore}&hoursBack=${hoursBack}&cursor=${searchNextCursor}&limit=20`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSearchResults((prev) => [...prev, ...(data.items || [])]);
      setSearchNextCursor(data.nextCursor || null);
    } catch (e) {
      console.error("Search load more failed:", e);
    } finally {
      setSearchLoadingMore(false);
    }
  }, [searchNextCursor, searchLoadingMore, searchQuery]);

  const handleClearSearch = useCallback(() => {
    setIsSearchActive(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchTotal(0);
    setSearchNextCursor(null);
  }, []);

  const filteredItems = useMemo(() => {
    return applyFilters(watchedItems, cardFilter, scoreFilter, stats?.max_score || 0);
  }, [watchedItems, cardFilter, scoreFilter, stats?.max_score]);

  // Filter heatmap, trend, threads by watched industries
  const filteredHeatmap = useMemo(() => {
    if (!watched || watched.length === 0) return heatmap || [];
    return (heatmap || []).filter(h => watched.includes(h.industry));
  }, [heatmap, watched]);

  const filteredThreads = useMemo(() => {
    if (!watched || watched.length === 0) return threads || [];
    return (threads || []).filter(t => {
      if (!t.industries || t.industries.length === 0) return true;
      return t.industries.some((ind: string) => watched.includes(ind));
    });
  }, [threads, watched]);

  // Pass watched to IndustryTrendChart so it only shows watched industry lines
  const trendWatched = watched.length > 0 ? watched : null;

  // Derive available industries from heatmap for the selector
  const availableIndustries = useMemo(() => {
    return (heatmap || []).slice(0, 20).map(h => ({ industry: h.industry, signalCount: h.signalCount }));
  }, [heatmap]);

  const hasData = items.length > 0;

  // 内容导航：长页面快速定位（sticky + scroll-spy），区块随可用数据动态出现
  const navItems = useMemo(() => {
    const itemsArr: { id: string; label: string }[] = [{ id: "overview", label: "概览" }];
    if (hasData) {
      itemsArr.push({ id: "charts", label: "图表" });
      if (sentimentBreakdown.length > 0) itemsArr.push({ id: "sentiment", label: "情感" });
      if (trend.length >= 2) itemsArr.push({ id: "trend", label: "趋势" });
    }
    itemsArr.push({ id: "threads", label: "事件线索" });
    itemsArr.push({ id: "backtest", label: "回测" });
    itemsArr.push({ id: "timeline", label: isSearchActive ? "搜索结果" : "时间线" });
    return itemsArr;
  }, [hasData, sentimentBreakdown.length, trend.length, isSearchActive]);

  return (
    <>
      <Head>
        <title>信号分析 — 财经信号</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content="AI 驱动的财经信号识别引擎 — 政策、行业、公司信号强度分析" />
      </Head>

      <SiteHeader onRefresh={doRefresh} refreshing={fetching} lastUpdated={null} />
      <ContentNav items={navItems} />
      <SignalAlert items={watchedItems} />

      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-[720px] lg:max-w-[960px] xl:max-w-[1200px] px-4 sm:px-6 pb-12">
          <div className="pt-8 pb-5 flex items-end justify-between flex-wrap gap-2">
            <h2 className="text-[13px] sm:text-sm text-muted-foreground font-normal">
              政策 · 行业 · 公司 — AI 智能分析，一目了然
            </h2>
            <IndustrySelector
              industries={availableIndustries}
              watched={watched}
              onToggle={toggleIndustry}
              onClear={clearIndustries}
            />
          </div>

          <ErrorBanner message={error} />

          <WatchlistPanel items={items} threads={threads} />

          <SearchBar
            onSearch={handleSearch}
            onClear={handleClearSearch}
            loading={searchLoading}
            className="mb-5"
          />

          <div id="overview" className="scroll-mt-28">
            <AnalysisOverview
              stats={stats}
              items={watchedItems}
              loading={fetching && items.length === 0}
              filter={cardFilter}
              onFilterChange={setCardFilter}
            />
          </div>

          {/* Charts: 2-col grid + full-width trend (client-only to avoid hydration mismatch) */}
          {hasData && (
            <ClientOnly fallback={<div className="h-40 rounded-xl bg-muted/20 animate-pulse mb-6" />}>
              <div id="charts" className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 scroll-mt-28">
                <div className="bg-card border rounded-xl p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs sm:text-sm font-medium text-foreground">
                      {viewMode === "industry" ? "行业信号分布" : "公司提及热度"}
                    </h3>
                    <div className="flex items-center rounded-lg border text-[10px] sm:text-[11px] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setViewMode("industry")}
                        className={`px-2 py-1 transition-colors ${
                          viewMode === "industry"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        行业
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("company")}
                        className={`px-2 py-1 transition-colors ${
                          viewMode === "company"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        公司
                      </button>
                    </div>
                  </div>
                  {viewMode === "industry" ? (
                    <IndustryBarChart data={filteredHeatmap} onIndustryClick={toggleIndustry} />
                  ) : (
                    <CompanyHeatmap data={companyHeatmap} />
                  )}
                  {/* 当日板块行情对照（A股惯例：红涨绿跌） */}
                  {viewMode === "industry" && marketToday.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] text-muted-foreground">今日板块涨跌</span>
                        <span className="text-[10px] text-muted-foreground">收盘</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {marketToday.map((m: any) => (
                          <span key={m.name} className="text-[11px] sm:text-xs flex items-center gap-1">
                            <span className="text-muted-foreground">{m.name}</span>
                            <span
                              className={
                                Number(m.change_pct) >= 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-emerald-600 dark:text-emerald-400"
                              }
                            >
                              {Number(m.change_pct) >= 0 ? "+" : ""}
                              {Number(m.change_pct).toFixed(2)}%
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-card border rounded-xl p-4 sm:p-5">
                  <h3 className="text-xs sm:text-sm font-medium text-foreground mb-3">
                    信号分类占比
                  </h3>
                  <CategoryDonutChart items={watchedItems} totalSignals={stats?.total_signals} />
                </div>
              </div>

              {/* Sentiment distribution (full width below the 2-col grid) */}
              {sentimentBreakdown.length > 0 && (
                <div id="sentiment" className="bg-card border rounded-xl p-4 sm:p-5 mb-6 scroll-mt-28">
                  <h3 className="text-xs sm:text-sm font-medium text-foreground mb-3">
                    情感分布
                  </h3>
                  <SentimentChart data={sentimentBreakdown} />
                </div>
              )}

              {trend.length >= 2 && (
                <div id="trend" className="bg-card border rounded-xl p-4 sm:p-5 mb-6 scroll-mt-28">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                    <h3 className="text-xs sm:text-sm font-medium text-foreground">
                      行业热度趋势
                    </h3>
                    <TimeRangeFilter value={trendHours} onChange={setTrendHours} />
                  </div>
                  <IndustryTrendChart data={trend} watched={trendWatched} />
                </div>
              )}

            </ClientOnly>
          )}

          <div id="threads" className="scroll-mt-28">
            <EventThreadList threads={filteredThreads} />
          </div>

          <div id="backtest" className="scroll-mt-28">
            <BacktestPanel />
          </div>

          <div id="timeline" className="scroll-mt-28">
          {isSearchActive ? (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs sm:text-sm font-medium text-foreground">
                  搜索结果
                </h3>
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="text-[11px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← 返回时间线
                </button>
              </div>
              <SignalSearchResults
                results={searchResults}
                total={searchTotal}
                loading={searchLoading}
                query={searchQuery}
                hasMore={!!searchNextCursor}
                onLoadMore={handleSearchLoadMore}
                loadingMore={searchLoadingMore}
              />
            </div>
          ) : (
            <>
              <ScoreFilter value={scoreFilter} onChange={setScoreFilter} />

              <h3 className="text-xs sm:text-sm font-medium text-foreground mb-3">
                信号时间线 {filteredItems.length > 0 && `(${filteredItems.length})`}
              </h3>
              <SignalTimeline
                items={filteredItems}
                hasMore={!!nextCursor}
                loading={loadingMore}
                onLoadMore={loadMore}
              />
            </>
          )}
          </div>

          {/* 页脚：免责声明 + P2.5 验证报告入口（内部工具） */}
          <div className="mt-10 pt-6 border-t border-border flex items-center justify-between flex-wrap gap-2">
            <p className="text-[10px] text-muted-foreground">
              分析仅作为信息准备，不构成投资建议
            </p>
            <Link
              href="/analytics/value"
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
            >
              价值验证报告
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

export async function getStaticProps() {
  try {
    const [news, stats, heatmap, trend, threads] = await Promise.all([
      getAnalyzedNews({ minScore: 1, hoursBack: 24, limit: 50 }),
      getAnalysisStats(24),
      getIndustryHeatmap(24),
      getIndustryTrend(24),
      getEventThreads(24),
    ]);
    const items = news.map((item) => {
      // Strip heavy text fields not needed for timeline rendering
      const { content, deep_analysis, ...light } = item;
      return {
        ...light,
        industries: light.industries ? safeParse(light.industries) : [],
        companies: light.companies ? safeParse(light.companies) : [],
        tags: light.tags ? safeParse(light.tags) : [],
      };
    });
    return {
      props: {
        stats: stats || { total_signals: 0, significant_count: 0, max_score: 0, critical_count: 0 },
        items: items || [],
        heatmap: heatmap || [],
        trend: trend || [],
        threads: threads || [],
        error: null,
        sentimentBreakdown: [],
        companyHeatmap: [],
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
        threads: [],
        error: "暂时无法获取分析数据，请稍后刷新",
        sentimentBreakdown: [],
        companyHeatmap: [],
      },
      revalidate: 60,
    };
  }
}
