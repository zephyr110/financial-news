import { url } from './sina.js';

// 过滤掉包含以下关键字的新闻
const filterArr = [
  '比特币',
  '以太坊',
  '莱特币',
  '疫苗',
  '疫情',
  '蓬佩奥',
];

/**
 * 从新浪财经 API 抓取并过滤新闻
 * @returns {Promise<Array>} 过滤后的新闻条目
 */
export async function fetchNews() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.10130',
      },
      signal: controller.signal,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`HTTP ${response.status}`);
    }

    const json = await response.json();

    const result = json?.result;
    if (!result || !result.status || result.status.code !== 0) {
      throw new Error('API returned non-zero status');
    }

    const items = result?.data?.feed?.list || [];

    return items.filter((item) => {
      if (!item.rich_text) return false;
      return !filterArr.some((keyword) => item.rich_text.includes(keyword));
    });
  } finally {
    clearTimeout(timeout);
  }
}
