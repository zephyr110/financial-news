import { fetchNews } from './fetchNews.js';
import { insertNews, insertNewsBatch } from './db.js';
import { FILTER_KEYWORDS } from './constants.js';

// --- CLS (财联社) Telegraph API ---
// Free public API for 7x24 flash news
const CLS_URL = 'https://www.cls.cn/api/sw?app=CailianpressWeb&os=web&sv=8.4.6';

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

/** Parse a date-like value to ISO string; fall back to now if invalid. */
function toIsoOrNow(value) {
  if (!value) return new Date().toISOString();
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function normalizeSinaItem(item) {
  const published = item.create_time
    ? toIsoOrNow(item.create_time.replace(' ', 'T') + '+08:00')
    : new Date().toISOString();
  return {
    source: 'sina',
    source_id: String(item.id),
    title: null,
    content: item.rich_text,
    published_at: published,
  };
}

function normalizeEastmoneyItem(item) {
  return {
    source: 'eastmoney',
    source_id: String(item.code || `${item.showTime}_${item.title?.slice(0, 40)}`),
    title: item.title || null,
    content: item.content || '',
    published_at: toIsoOrNow(item.showTime),
  };
}

function normalizeClsItem(item) {
  return {
    source: 'cls',
    source_id: String(item.id || `${item.ctime}_${item.title?.slice(0, 30)}`),
    title: item.title || null,
    content: item.content || item.brief || '',
    published_at: toIsoOrNow(item.ctime),
  };
}

// --- Fetchers ---

async function fetchSinaNews() {
  try {
    const items = await fetchNews(); // reuse existing fetcher
    return items.flatMap((item) => {
      try {
        return [normalizeSinaItem(item)];
      } catch (err) {
        console.warn('Sina normalize skipped:', err.message);
        return [];
      }
    });
  } catch (err) {
    console.error('Sina fetch failed:', err.message);
    return [];
  }
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
        if (!text) return false;
        return !FILTER_KEYWORDS.some(kw => text.includes(kw));
      })
      .flatMap((item) => {
        try {
          return [normalizeEastmoneyItem(item)];
        } catch (err) {
          console.warn('Eastmoney normalize skipped:', err.message);
          return [];
        }
      });
  } catch (err) {
    console.error('Eastmoney fetch failed:', err.message);
    console.error('Eastmoney stack:', err.stack);
    return []; // Non-fatal: Sina is the primary source
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchClsNews() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(CLS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.cls.cn/',
      },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`CLS HTTP ${res.status}`);
    const text = await res.text();
    // CLS returns JSONP-like format: callback({...})
    // Use `s` flag for multi-line, with fallback for regular JSON
    const jsonMatch = text.match(/^\w+\(([\s\S]*)\)\s*$/);
    let json;
    if (jsonMatch) {
      try { json = JSON.parse(jsonMatch[1]); } catch { json = {}; }
    } else {
      try { json = JSON.parse(text); } catch { json = {}; }
    }
    const raw = json?.data?.roll_data || json?.data || [];
    const list = Array.isArray(raw) ? raw : [];
    return list
      .filter(item => {
        const txt = item.content || item.brief || item.title || '';
        if (!txt) return false;
        return !FILTER_KEYWORDS.some(kw => txt.includes(kw));
      })
      .flatMap(item => {
        try { return [normalizeClsItem(item)]; } catch { return []; }
      });
  } catch (err) {
    console.error('CLS fetch failed:', err.message);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

// --- Main Archive Function ---

/**
 * Fetch from all sources, normalize, dedupe-insert into SQLite.
 * Returns counts per source.
 */
/**
 * Fetch live news from all sources without DB insertion.
 * Used by getStaticProps and /api/news for real-time supplement.
 */
export async function fetchLiveNews() {
  const [sinaItems, emItems, clsItems] = await Promise.all([
    fetchSinaNews(),
    fetchEastmoneyNews(),
    fetchClsNews(),
  ]);

  // Merge and normalize to a common format (matching what frontend expects)
  const all = [];
  for (const item of sinaItems) {
    all.push({ id: `s_${item.source_id}`, rich_text: item.content, published_at: item.published_at, source: item.source });
  }
  for (const item of emItems) {
    all.push({ id: `e_${item.source_id}`, rich_text: item.content, published_at: item.published_at, source: item.source, title: item.title });
  }
  for (const item of clsItems) {
    all.push({ id: `c_${item.source_id}`, rich_text: item.content, published_at: item.published_at, source: item.source, title: item.title });
  }

  // Sort by time desc
  all.sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));
  return all;
}

export async function archiveNews() {
  const counts = { sina: 0, eastmoney: 0, cls: 0, duplicates: 0 };

  // Fetch from all sources in parallel
  const [sinaItems, emItems, clsItems] = await Promise.all([
    fetchSinaNews(),
    fetchEastmoneyNews(),
    fetchClsNews(),
  ]);

  const sinaInserted = await insertNewsBatch(sinaItems);
  counts.sina = sinaInserted;
  counts.duplicates += sinaItems.length - sinaInserted;

  const emInserted = await insertNewsBatch(emItems);
  counts.eastmoney = emInserted;
  counts.duplicates += emItems.length - emInserted;

  const clsInserted = await insertNewsBatch(clsItems);
  counts.cls = clsInserted;
  counts.duplicates += clsItems.length - clsInserted;

  console.log(`[archive] sina=${counts.sina} eastmoney=${counts.eastmoney} cls=${counts.cls} dup=${counts.duplicates}`);
  return counts;
}
