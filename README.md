# Financial News

财经新闻聚合 + **政策-行业影响分析引擎** — Next.js + ISR，Turso/SQLite 归档，LLM 信号筛选。

## 功能

- 新浪 / 东方财富 7×24 快讯抓取，智能过滤与去重归档
- AI 信号筛选：政策 / 行业 / 地缘 / 公司 / 宏观打分（1–5）
- 分析面板 `/analysis`：信号时间线、概览统计、分类与行业标签
- 首页实时资讯：暗色模式、下拉刷新、响应式布局
- RSS 2.0 / JSON Feed 订阅

## 技术栈

Next.js 16 (Pages Router) · Tailwind CSS v4 · shadcn/ui · Turso (libSQL) · OpenAI-compatible LLM API

## 开发

```bash
pnpm install
pnpm dev      # http://localhost:3000  ·  分析面板 /analysis
pnpm build
pnpm start
```

未配置 Turso 时，本地默认使用项目根目录的 `news_archive.db` 文件。

本地触发归档 / 分析（需配置 LLM API key）：

```bash
curl "http://localhost:3000/api/cron/fetch"
curl "http://localhost:3000/api/cron/analyze"
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LLM_API_KEY` | LLM API 密钥（优先使用） | — |
| `LLM_BASE_URL` | LLM Chat Completions 端点 | `https://api.deepseek.com/v1` |
| `LLM_MODEL` | 模型名称 | `deepseek-v4-flash` |
| `DEEPSEEK_API_KEY` | LLM_API_KEY 的后备（兼容旧配置） | — |
| `ANTHROPIC_AUTH_TOKEN` | 第二后备（本地 keychain 兼容） | — |
| `CRON_SECRET` | 生产环境必需，保护 cron 端点 | — |
| `TURSO_DATABASE_URL` | 生产必需；本地可选（未设则用本地 SQLite） | — |
| `TURSO_AUTH_TOKEN` | 配合 Turso URL 的鉴权 token | — |
| `NEWS_DB_PATH` | 可选，仅本地文件模式的 SQLite 路径 | `news_archive.db` |

### 切换 LLM 提供商

```bash
# OpenAI
LLM_BASE_URL=https://api.openai.com LLM_MODEL=gpt-4o LLM_API_KEY=sk-...

# 其他 OpenAI-compatible 提供商
LLM_BASE_URL=https://your-endpoint LLM_MODEL=your-model LLM_API_KEY=your-key
```

## Cron 端点

需带 `?token=<CRON_SECRET>` 或 `Authorization: Bearer <CRON_SECRET>`（生产环境强制校验）：

| 端点 | 作用 |
|------|------|
| `GET /api/cron/fetch` | 双源新闻归档 |
| `GET /api/cron/analyze` | LLM 信号分析 |
| `GET /api/cron/stats` | 用量与 DB 统计 |

公开只读：`GET /api/analysis?hoursBack=24&minScore=1`

## 定时调度

使用 **GitHub Actions** 每小时触发 fetch + analyze（`.github/workflows/cron.yml`）。

在 GitHub 仓库 Settings → Secrets → Actions 配置：
- `APP_URL` — 部署域名（如 `https://financial-news-nine.vercel.app`）
- `CRON_SECRET` — 与 Vercel 环境变量一致

## 部署（Vercel + Turso）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zephyr110/financial-news)

1. 在 [Turso](https://turso.tech) 创建数据库，拿到 URL 与 token
2. Vercel Environment Variables 配置：
   - `LLM_API_KEY`（或 `DEEPSEEK_API_KEY`）
   - `CRON_SECRET`
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
3. GitHub Actions Secrets 配置 `APP_URL` 和 `CRON_SECRET`
4. Redeploy

历史新闻与分析结果持久保存在 Turso，分析面板可跨实例正常使用。

首次上线后建议手动触发一次 fetch + analyze，确认 `/analysis` 有数据。

## License

[MIT](LICENSE)。
