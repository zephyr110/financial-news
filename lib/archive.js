import { fetchNews } from './fetchNews.js';
import { insertNews, insertNewsBatch } from './db.js';
import { FILTER_KEYWORDS } from './constants.js';

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
  const [sinaItems, emItems, clsItems, jqkaItems, wallItems] = await Promise.all([
    fetchSinaNews(),
    fetchEastmoneyNews(),
    fetchClsNews(),
    fetch10jqkaNews(),
    fetchWallstreetcnNews(),
  ]);

  // Merge and normalize to a common format (matching what frontend expects)
  const all = [];
  const addItems = (items) => {
    for (const item of items) {
      all.push({ id: `${item.source}_${item.source_id}`, rich_text: item.content, published_at: item.published_at, source: item.source, title: item.title });
    }
  };
  addItems(sinaItems);
  addItems(jqkaItems);
  addItems(wallItems);
  addItems(emItems);
  addItems(clsItems);

  // Sort by time desc
  all.sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));
  return all;
}

export async function archiveNews() {
  const counts = { sina: 0, jqka: 0, wallstreetcn: 0, duplicates: 0 };

  // Fetch from all available sources in parallel
  const [sinaItems, emItems, clsItems, jqkaItems, wallItems] = await Promise.all([
    fetchSinaNews(),
    fetchEastmoneyNews(),
    fetchClsNews(),
    fetch10jqkaNews(),
    fetchWallstreetcnNews(),
  ]);

  const sinaInserted = await insertNewsBatch(sinaItems);
  counts.sina = sinaInserted;
  counts.duplicates += sinaItems.length - sinaInserted;

  // Eastmoney/CLS currently degraded (API down); counts tracked when APIs resume
  if (emItems.length > 0) {
    const emInserted = await insertNewsBatch(emItems);
    counts.duplicates += emItems.length - emInserted;
  }
  if (clsItems.length > 0) {
    const clsInserted = await insertNewsBatch(clsItems);
    counts.duplicates += clsItems.length - clsInserted;
  }
  if (jqkaItems.length > 0) {
    const jqkaInserted = await insertNewsBatch(jqkaItems);
    counts.jqka = jqkaInserted;
    counts.duplicates += jqkaItems.length - jqkaInserted;
  }
  if (wallItems.length > 0) {
    const wallInserted = await insertNewsBatch(wallItems);
    counts.wallstreetcn = wallInserted;
    counts.duplicates += wallItems.length - wallInserted;
  }

  console.log(`[archive] sina=${counts.sina} jqka=${counts.jqka} wallstreetcn=${counts.wallstreetcn} dup=${counts.duplicates}`);
  return counts;
}
