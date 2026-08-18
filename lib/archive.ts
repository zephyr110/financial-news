import { fetchNews } from './fetchNews';
import { insertNews, insertNewsBatch, logEvent, EVENT_TYPES } from './db';
import { FILTER_KEYWORDS } from './constants';
import { registerNewsSource, getActiveNewsSources, type NewsSourceProvider } from './providers';

// Eastmoney & CLS news APIs are currently unavailable (404/405 as of 2026-07).
// Infrastructure kept for when APIs are re-enabled. Sina remains the primary working source.
// See fetchEastmoneyNews() and fetchClsNews() — currently return [].

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

// --- Unix timestamp helper: auto-detect seconds vs milliseconds ---
function parseUnixTs(ts) {
  if (!ts) return null;
  const num = Number(ts);
  if (!Number.isFinite(num)) return null;
  // If > 1e12, it's already in milliseconds (post year 33658)
  return new Date(num > 1e12 ? num : num * 1000);
}

// --- 同花顺 (10jqka) 7x24 flash news ---
async function fetch10jqkaNews() {
  try {
    const res = await fetch('https://news.10jqka.com.cn/tapp/news/push/stock/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`10jqka HTTP ${res.status}`);
    const json = await res.json();
    const list = json?.data?.list || [];
    return list
      .filter(item => {
        const txt = item.digest || item.title || '';
        if (!txt) return false;
        return !FILTER_KEYWORDS.some(kw => txt.includes(kw));
      })
      .flatMap(item => {
        try {
          const dt = parseUnixTs(item.ctime);
          return [{
            source: '10jqka',
            source_id: String(item.id),
            title: item.title || null,
            content: (item.digest || item.title || '').slice(0, 500),
            published_at: dt ? dt.toISOString() : new Date().toISOString(),
          }];
        } catch { return []; }
      });
  } catch (err) {
    console.error('10jqka fetch failed:', err.message);
    return [];
  }
}

// --- 华尔街见闻 (Wallstreetcn) live news ---
async function fetchWallstreetcnNews() {
  try {
    const res = await fetch('https://api-one.wallstcn.com/apiv1/content/lives?channel=global-channel&limit=20', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Wallstreetcn HTTP ${res.status}`);
    const json = await res.json();
    const list = json?.data?.items || [];
    return list
      .filter(item => {
        const txt = item.content_text || item.title || '';
        if (!txt) return false;
        return !FILTER_KEYWORDS.some(kw => txt.includes(kw));
      })
      .flatMap(item => {
        try {
          const dt = parseUnixTs(item.display_time);
          return [{
            source: 'wallstreetcn',
            source_id: String(item.id),
            title: item.title || null,
            content: (item.content_text || item.title || '').slice(0, 500),
            published_at: dt ? dt.toISOString() : new Date().toISOString(),
          }];
        } catch { return []; }
      });
  } catch (err) {
    console.error('Wallstreetcn fetch failed:', err.message);
    return [];
  }
}

async function fetchEastmoneyNews() {
  // Eastmoney news API deprecated (404 as of 2026-07). Placeholder for future re-enablement.
  return [];
}

async function fetchClsNews() {
  // CLS API returns HTML/requires signature (405 as of 2026-07). Placeholder for future re-enablement.
  return [];
}

// --- NewsSource seam: register providers (spec §10.2 原则1) ---
// 新增信源 = 实现 NewsSourceProvider 并 registerNewsSource(...)，无需改主流程。
// 配置级启停：环境变量 NEWS_SOURCES="sina,10jqka"（白名单），见 lib/providers.ts。

const providers: NewsSourceProvider[] = [
  { id: 'sina', name: '新浪 7×24', fetch: fetchSinaNews },
  { id: 'eastmoney', name: '东方财富快讯', fetch: fetchEastmoneyNews },
  { id: 'cls', name: '财联社', fetch: fetchClsNews },
  { id: '10jqka', name: '同花顺 7×24', fetch: fetch10jqkaNews },
  { id: 'wallstreetcn', name: '华尔街见闻', fetch: fetchWallstreetcnNews },
];
for (const p of providers) registerNewsSource(p);

// --- Main Archive Function ---

/**
 * Fetch live news from all active sources without DB insertion.
 * Used by getStaticProps and /api/news for real-time supplement.
 */
export async function fetchLiveNews() {
  const active = getActiveNewsSources();
  const results = await Promise.all(active.map((p) => p.fetch()));

  // Merge and normalize to a common format (matching what frontend expects)
  const all = [];
  for (const items of results) {
    for (const item of items) {
      all.push({ id: `${item.source}_${item.source_id}`, rich_text: item.content, published_at: item.published_at, source: item.source, title: item.title });
    }
  }

  // Sort by time desc
  all.sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));
  return all;
}

export async function archiveNews() {
  const active = getActiveNewsSources();
  const counts = { duplicates: 0 };
  const sourceCounts: Record<string, number> = {};

  // Fetch from all active sources in parallel
  const results = await Promise.all(active.map((p) => p.fetch()));

  for (let i = 0; i < active.length; i++) {
    const provider = active[i];
    const items = results[i];
    if (items.length === 0) continue;
    const inserted = await insertNewsBatch(items);
    sourceCounts[provider.id] = inserted;
    counts.duplicates += items.length - inserted;
    if (inserted > 0) {
      await logEvent(EVENT_TYPES.NEWS_INGESTED, {
        payload: { source: provider.id, count: inserted },
      });
    }
  }

  console.log(`[archive] ${Object.entries(sourceCounts).map(([k, v]) => `${k}=${v}`).join(' ')} dup=${counts.duplicates}`);
  return { ...counts, ...sourceCounts };
}
