import { Feed } from 'feed';

/**
 * 根据新闻条目生成 RSS Feed
 * @param {Array} items - 新闻条目列表
 * @returns {Feed}
 */
/**
 * 根据新闻条目生成 RSS Feed
 * @param {Array} items - 新闻条目列表
 * @param {string} siteUrl - 站点根 URL（从环境变量 SITE_URL 读取）
 * @returns {Feed}
 */
export function generateFeed(items, siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000') {
  const feed = new Feed({
    title: '财经信号',
    description: 'AI 驱动的财经新闻聚合与信号分析 — 新浪 7×24 全球实时快讯',
    link: siteUrl,
    language: 'zh-CN',
    generator: 'financial-signal',
    feedLinks: {
      json: `${siteUrl}/api/rss.json`,
      rss: `${siteUrl}/api/rss.xml`,
    },
  });

  items.forEach((item) => {
    feed.addItem({
      title: item.rich_text,
      id: String(item.id),
      link: item.docurl,
      content: '',
      date: new Date(item.create_time + '+08:00'),
    });
  });

  return feed;
}
