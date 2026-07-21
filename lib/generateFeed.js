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
    title: '新浪新闻',
    description: '新浪全球实时财经新闻直播',
    link: siteUrl,
    language: 'zh-CN',
    generator: 'financial-news',
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
