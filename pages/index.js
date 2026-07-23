import Head from "next/head";
import { fetchNews } from "../lib/fetchNews";
import NewsList from "../components/NewsList";
import ThemeToggle from "../components/ThemeToggle";
import ErrorBanner from "../components/ErrorBanner";
import EmptyState from "../components/EmptyState";

export default function Home({ items, error }) {
  return (
    <>
      <Head>
        <title>Financial News — 全球实时财经新闻</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="新浪全球实时财经新闻直播"
        />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Recent Entries"
          href="/api/rss.xml"
        />
      </Head>

      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-[720px] px-4 sm:px-6">
          {/* Header */}
          <header className="flex items-center justify-between pt-8 pb-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                全球实时财经新闻
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                新浪财经 7×24 直播 · 实时更新
              </p>
            </div>
            <ThemeToggle />
          </header>

          {/* Divider */}
          <hr className="border-border mb-6" />

          {/* Error */}
          <ErrorBanner message={error} />

          {/* Content */}
          {!error && (!items || items.length === 0) ? (
            <EmptyState />
          ) : (
            !error && Array.isArray(items) && items.length > 0 && (
              <NewsList items={items} />
            )
          )}

          {/* Footer */}
          <footer className="py-10 text-center text-xs text-muted-foreground">
            <p>
              Powered by{" "}
              <a
                href="https://zhibo.sina.com.cn"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                新浪财经
              </a>
              {" "}·{" "}
              <a
                href="/api/rss.xml"
                className="text-primary hover:underline"
              >
                RSS
              </a>
              {" / "}
              <a
                href="/api/rss.json"
                className="text-primary hover:underline"
              >
                JSON Feed
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
      revalidate: 3600,
    };
  } catch (e) {
    console.error("Failed to fetch news:", e);
    // Throw to let Next.js ISR serve the last-good cached page
    // instead of deploying an empty error page
    throw e;
  }
}
