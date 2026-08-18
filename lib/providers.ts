/**
 * Capability Seams — 能力接缝（spec §10.2 原则1：Service Definition + Provider + Consumer）
 *
 * 本项目三大接缝：
 *  - NewsSource seam  → lib/providers.ts（本文件）：信源注册表，配置级切换
 *  - Analyzer seam    → lib/llm/（config.ts + client.ts）：OpenAI 兼容客户端，
 *                       由 env（LLM_API_KEY / LLM_BASE_URL / LLM_MODEL）驱动切换，无需改代码
 *  - Store seam       → lib/db.ts：独立存储模块（Turso/SQLite），接口即函数签名
 */

export interface NewsItem {
  source: string;
  source_id: string;
  title: string | null;
  content: string;
  published_at: string;
}

/** 新闻信源接缝：一个可抓取、可规范化的新闻流。fetch() 永不抛错，失败返回 []。 */
export interface NewsSourceProvider {
  /** 唯一标识，如 'sina' | '10jqka' | 'wallstreetcn' */
  id: string;
  /** 展示名 */
  name: string;
  fetch(): Promise<NewsItem[]>;
}

const newsSources = new Map<string, NewsSourceProvider>();

/** 注册信源 Provider（模块加载时执行）。 */
export function registerNewsSource(provider: NewsSourceProvider) {
  newsSources.set(provider.id, provider);
}

export function getNewsSource(id: string): NewsSourceProvider | undefined {
  return newsSources.get(id);
}

/**
 * 启用中的信源列表。
 *
 * 配置方式（配置级切换，改 env 即可增减信源）：
 *  - NEWS_SOURCES="sina,10jqka"        — 白名单，仅列出的启用
 *  - NEWS_SOURCES 不设置或为空字符串    — 全部启用
 */
export function getActiveNewsSources(): NewsSourceProvider[] {
  const configured = process.env.NEWS_SOURCES;
  if (!configured) return [...newsSources.values()];
  const whitelist = configured
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...newsSources.values()].filter((p) => whitelist.includes(p.id));
}

/** 已注册的全部信源（含禁用），用于统计/诊断。 */
export function getAllNewsSources(): NewsSourceProvider[] {
  return [...newsSources.values()];
}
