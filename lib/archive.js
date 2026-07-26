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
  const counts = { sina: 0, duplicates: 0 };

  // Fetch from all available sources in parallel
  const [sinaItems, emItems, clsItems] = await Promise.all([
    fetchSinaNews(),
    fetchEastmoneyNews(),
    fetchClsNews(),
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

  console.log(`[archive] sina=${counts.sina} (eastmoney+cls APIs degraded) dup=${counts.duplicates}`);
  return counts;
}
