import { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import Link from "next/link";
import { ArrowLeft, Loader2, Zap, AlertCircle, CalendarDays } from "lucide-react";
import SiteHeader from "../../components/SiteHeader";
import SignalBadge from "../../components/SignalBadge";
import ErrorBanner from "../../components/ErrorBanner";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, CATEGORY_COLORS, SCORE_LABELS } from "@/lib/constants";
import { getEventThreads, getEventThreadById } from "../../lib/db";
import { formatDate, formatTime } from "../../lib/format";

const STAGE_LABELS = {
  early: "早期",
  brewing: "发酵中",
  spreading: "全面扩散",
  priced_in: "成熟定价",
};

const STAGE_COLORS = {
  early: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  brewing: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  spreading: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  priced_in: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function ThreadPage({ data: ssgData, error: ssgError }) {
  const router = useRouter();
  const [data, setData] = useState(ssgData || null);
  const [error, setError] = useState(ssgError ?? null);
  const [loading, setLoading] = useState(false);

  // Fallback: fetch client-side if not pre-rendered
  const rawId = router.query.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  useEffect(() => {
    if (ssgData) return;
    if (!id || !router.isReady) return;

    let cancelled = false;
    setLoading(true);
    fetch(`/api/thread/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? "NOT_FOUND" : `HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message === "NOT_FOUND" ? "事件线索不存在" : "加载失败，请稍后重试");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [id, router.isReady, ssgData]);

  if (loading) {
    return (
      <>
        <Head><title>加载中… — 财经信号</title></Head>
        <SiteHeader onRefresh={() => {}} refreshing={false} lastUpdated={null} />
        <div className="min-h-screen bg-background">
          <div className="mx-auto max-w-[720px] lg:max-w-[960px] px-4 sm:px-6 pb-12 pt-8">
            <div className="flex items-center justify-center py-20 gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">加载中…</span>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error && !data) {
    return (
      <>
        <Head><title>事件线索 — 财经信号</title></Head>
        <SiteHeader onRefresh={() => {}} refreshing={false} lastUpdated={null} />
        <div className="min-h-screen bg-background">
          <div className="mx-auto max-w-[720px] lg:max-w-[960px] px-4 sm:px-6 pb-12 pt-8">
            <Link
              href="/analysis"
              className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回分析面板
            </Link>
            <ErrorBanner message={error} />
          </div>
        </div>
      </>
    );
  }

  const thread = data;

  return (
    <>
      <Head>
        <title>
          {thread ? `${thread.title} — 事件线索 | 财经信号` : "事件线索 — 财经信号"}
        </title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content={thread?.narrative?.slice(0, 160) || "AI 识别的事件线索及其成员信号"}
        />
      </Head>

      <SiteHeader onRefresh={() => {}} refreshing={false} lastUpdated={null} />

      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-[720px] lg:max-w-[960px] px-4 sm:px-6 pb-12 pt-8">
          <Link
            href="/analysis"
            className="inline-flex items-center gap-1 text-[11px] sm:text-xs text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回分析面板
          </Link>

          {thread ? (
            <>
              {/* 线索头部 */}
              <div className="bg-card border rounded-xl p-4 sm:p-6 mb-6">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  {thread.confidence === "high" ? (
                    <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <h1 className="text-base sm:text-lg font-semibold text-foreground">
                    {thread.title}
                  </h1>
                  <span className={cn(
                    "text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-full font-medium",
                    STAGE_COLORS[thread.stage] || STAGE_COLORS.early
                  )}>
                    {STAGE_LABELS[thread.stage] || thread.stage}
                  </span>
                </div>

                <p className="text-[13px] sm:text-sm text-foreground leading-relaxed mb-3">
                  {thread.narrative}
                </p>

                <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  生成于 {formatDate(thread.created_at)} {formatTime(thread.created_at)}
                </div>

                {thread.industries?.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-3">
                    <span className="text-[10px] text-muted-foreground">涉及行业：</span>
                    {thread.industries.map((ind: string) => (
                      <span
                        key={ind}
                        className="text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground"
                      >
                        {ind}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 后续关注 */}
              {thread.watch_points?.length > 0 && (
                <div className="bg-card border rounded-xl p-4 sm:p-6 mb-6">
                  <h3 className="text-xs sm:text-sm font-medium text-foreground mb-3">
                    后续关注
                  </h3>
                  <ul className="space-y-1.5">
                    {thread.watch_points.map((p: string, i: number) => (
                      <li
                        key={i}
                        className="text-[12px] sm:text-[13px] text-muted-foreground flex items-start gap-2"
                      >
                        <span className="text-primary mt-1">•</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 成员信号 */}
              <div className="bg-card border rounded-xl p-4 sm:p-6">
                <h3 className="text-xs sm:text-sm font-medium text-foreground mb-3">
                  成员信号（{thread.signals?.length || 0} 条）
                </h3>
                {!thread.signals || thread.signals.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    暂无成员信号数据
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {thread.signals.map((s: any) => (
                      <Link
                        key={s.id}
                        href={`/signal/${s.id}`}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-background hover:border-primary/50 hover:bg-accent/40 transition-colors"
                      >
                        <SignalBadge score={s.signal_score} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] sm:text-sm text-foreground leading-relaxed">
                            {s.summary}
                          </p>
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "text-[10px] px-1.5 py-0.5 rounded font-medium",
                              CATEGORY_COLORS[s.category] || CATEGORY_COLORS.macro
                            )}>
                              {CATEGORY_LABELS[s.category] || s.category}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {SCORE_LABELS[s.signal_score] || ""}信号
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                              {formatDate(s.published_at)} {formatTime(s.published_at)}
                            </span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-20 text-sm text-muted-foreground">
              事件线索不存在或已被移除
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * ISR: pre-render recent event threads, fallback for the rest.
 */
export async function getStaticPaths() {
  try {
    const threads = await getEventThreads(24 * 7);
    return {
      paths: threads.map((t: any) => ({ params: { id: String(t.id) } })),
      fallback: true,
    };
  } catch {
    return { paths: [], fallback: true };
  }
}

export async function getStaticProps({ params }: { params: { id: string } }) {
  const threadId = Number(params.id);

  if (!Number.isFinite(threadId) || threadId < 1) {
    return { notFound: true };
  }

  try {
    const thread = await getEventThreadById(threadId);

    if (!thread) {
      return { notFound: true };
    }

    return {
      props: {
        data: thread,
        error: null,
      },
      revalidate: 3600,
    };
  } catch (e) {
    console.error(`[thread/${threadId}] getStaticProps error:`, e);
    return {
      props: {
        data: null,
        error: "暂时无法加载事件线索，请稍后刷新",
      },
      revalidate: 60,
    };
  }
}
