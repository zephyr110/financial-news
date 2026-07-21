import Head from 'next/head';
import { fetchNews } from '../lib/fetchNews';

export default function Home({ items, error }) {
  return (
    <>
      <Head>
        <title>Financial News</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="新浪全球实时财经新闻直播"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/bulma@0.9.1/css/bulma.min.css"
        />
        <link
          rel="alternate"
          type="application/rss+xml"
          title="Recent Entries"
          href="/api/rss.xml"
        />
      </Head>

      <section className="section">
        <div className="container">
          <h1 className="title">全球实时财经新闻</h1>

          {error ? (
            <div className="notification is-warning">
              暂时无法获取最新新闻，请稍后刷新页面。正在显示最近一次缓存的数据。
            </div>
          ) : null}

          {!items || items.length === 0 ? (
            <p>暂无新闻数据。</p>
          ) : (
            <ol className="list">
              {items.map((item) => {
                const time = item.create_time
                  ? new Date(item.create_time + '+08:00')
                  : null;
                return (
                  <li key={item.id}>
                    <p>
                      {item.rich_text}{' '}
                      （
                      <a
                        href={item.docurl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {time && !isNaN(time.getTime())
                          ? time.toLocaleTimeString('zh-CN', {
                              hour12: false,
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '--:--'}
                      </a>
                      ）
                    </p>
                    <hr />
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </section>

      <style jsx>{`
        ol {
          margin-left: 0.75rem;
        }
        li {
          margin-top: 1rem;
        }
        p {
          max-width: 50rem;
        }
        @media (prefers-color-scheme: dark) {
          html {
            background-color: #181818;
          }
          h1,
          li {
            color: #d1d1d1 !important;
          }
          hr {
            background-color: #222222;
          }
        }
        @media (prefers-color-scheme: light) {
          html {
            background-color: #ffffff;
          }
          h1,
          li {
            color: #242424;
          }
        }
      `}</style>
    </>
  );
}

/**
 * ISR: 构建时抓取一次，之后每小时自动在后台重新生成。
 * 用户始终看到的是已缓存的最新版本，不会因 API 失败而白屏。
 */
export async function getStaticProps() {
  try {
    const items = await fetchNews();
    return {
      props: { items, error: null },
      revalidate: 3600,
    };
  } catch (error) {
    console.error('Failed to fetch news:', error);
    return {
      props: { items: [], error: error.message },
      revalidate: 300,
    };
  }
}
