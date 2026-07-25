import { fetchNews } from './fetchNews.js';
import { insertNews } from './db.js';

// --- Eastmoney 7x24 Global News ---
// Endpoint documented by community; may need adjustment during testing.
// Reference: a-stock-data project, "np-weblist" endpoint
const EASTMONEY_URL = 'https://np-listapi.eastmoney.com/comm/web/NewsContentListGet';
const EASTMONEY_PARAMS = new URLSearchParams({
  client: 'web',
  count: '100',
  scanRows: '100',
  npVersion: '1.2.0',
  npCateId: '0', // 0 = all categories
  fields: 'content,title,showTime,code',
});

// --- Normalizers ---

function normalizeSinaItem(item) {
  return {
    source: 'sina',
    source_id: String(item.id),
    title: null,
    content: item.rich_text,
    published_at: item.create_time
      ? new Date(item.create_time.replace(' ', 'T') + '+08:00').toISOString()
      : new Date().toISOString(),
  };
}

function normalizeEastmoneyItem(item) {
  // Eastmoney response format (subject to adjustment during testing):
  // { title, content, showTime, code }
  return {
    source: 'eastmoney',
    source_id: String(item.code || `${item.showTime}_${item.title?.slice(0, 30)}_${Math.random().toString(36).slice(2, 8)}`),
    title: item.title || null,
    content: item.content || '',
    published_at: item.showTime
      ? new Date(item.showTime).toISOString()
      : new Date().toISOString(),
  };
}

// --- Fetchers ---

async function fetchSinaNews() {
  const items = await fetchNews(); // reuse existing fetcher
  return items.map(normalizeSinaItem);
}

async function fetchEastmoneyNews() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const url = EASTMONEY_URL + '?' + EASTMONEY_PARAMS.toString();
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.eastmoney.com/',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Eastmoney HTTP ${res.status}`);
    const json = await res.json();
    // Eastmoney response structure varies; try common patterns
    const list = json?.data?.list || json?.data?.newsList || json?.result?.data || [];
    return list
      .filter(item => {
        const text = item.content || item.summary || '';
        return text;
      })
      .map(normalizeEastmoneyItem);
  } catch (err) {
    console.error('Eastmoney fetch failed:', err.message);
    console.error('Eastmoney stack:', err.stack);
    return []; // Non-fatal: Sina is the primary source
  } finally {
    clearTimeout(timeout);
  }
}

// --- Main Archive Function ---

/**
 * Fetch from all sources, normalize, dedupe-insert into SQLite.
 * Returns counts per source.
 */
export async function archiveNews() {
  const counts = { sina: 0, eastmoney: 0, duplicates: 0 };

  // Fetch from both sources in parallel
  const [sinaItems, emItems] = await Promise.all([
    fetchSinaNews(),
    fetchEastmoneyNews(),
  ]);

  // Insert Sina items
  for (const item of sinaItems) {
    const id = insertNews(item);
    if (id) counts.sina++;
    else counts.duplicates++;
  }

  // Insert Eastmoney items
  for (const item of emItems) {
    const id = insertNews(item);
    if (id) counts.eastmoney++;
    else counts.duplicates++;
  }

  console.log(`[archive] sina=${counts.sina} eastmoney=${counts.eastmoney} dup=${counts.duplicates}`);
  return counts;
}
