# 财经信号

财经新闻聚合 + **政策-行业影响分析引擎** — Next.js + ISR，Turso/SQLite 归档，AI 信号筛选。

## 功能

- **双源新闻归档** — 新浪 + 东方财富 7×24 快讯自动采集、过滤、去重
- **AI 信号筛选** — LLM 对每条新闻打分（1–5），识别政策 / 行业 / 地缘 / 公司 / 宏观信号
- **分析面板** `/analysis` — 信号强度卡片、行业柱状图、分类环形图、行业热度趋势折线图、焦点热词、信号时间线
- **首页实时快讯** — 按日期折叠、下拉刷新、暗色模式、响应式布局
- **RSS 2.0 / JSON Feed**

## 技术栈

Next.js 16 (Pages Router) · Tailwind CSS v4 · shadcn/ui · Recharts · Turso (libSQL) · OpenAI-compatible LLM API

## 开发

```bash
pnpm install
pnpm dev      # http://localhost:3000  →  分析面板 /analysis
pnpm build
pnpm start
```

未配置 Turso 时，本地默认使用项目根目录的 `news_archive.db`。

本地触发归档 / 分析（需配置 LLM API key）：

```bash
curl "http://localhost:3000/api/cron/fetch"
curl "http://localhost:3000/api/cron/analyze"
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LLM_API_KEY` | LLM API 密钥 | — |
| `LLM_BASE_URL` | Chat Completions 端点 | `https://api.deepseek.com/v1` |
| `LLM_MODEL` | 模型名称 | `deepseek-v4-flash` |
| `DEEPSEEK_API_KEY` | `LLM_API_KEY` 后备 | — |
| `CRON_SECRET` | 保护 cron 端点 | — |
| `TURSO_DATABASE_URL` | 生产环境 Turso 地址 | — |
| `TURSO_AUTH_TOKEN` | Turso 鉴权 token | — |
| `NEWS_DB_PATH` | 本地 SQLite 文件路径 | `news_archive.db` |

### 切换 LLM 提供商

```bash
# OpenAI
LLM_BASE_URL=https://api.openai.com LLM_MODEL=gpt-4o LLM_API_KEY=sk-...

# 任意 OpenAI-compatible 服务
LLM_BASE_URL=https://your-endpoint LLM_MODEL=your-model LLM_API_KEY=your-key
```

## API

| 端点 | 说明 |
|------|------|
| `GET /api/cron/fetch` | 双源新闻归档（需鉴权） |
| `GET /api/cron/analyze` | LLM 信号分析（需鉴权） |
| `GET /api/cron/stats` | 用量与 DB 统计（需鉴权） |
| `GET /api/analysis?hoursBack=24&minScore=1&trendHours=168` | 分析数据（公开） |
| `GET /api/news` | 归档新闻（公开） |
| `GET /api/rss.xml` | RSS 2.0 |
| `GET /api/rss.json` | JSON Feed |

## 定时调度

GitHub Actions 每小时触发 fetch + analyze（`.github/workflows/cron.yml`）。

GitHub Secrets 配置：
- `APP_URL` — 部署域名
- `CRON_SECRET` — 与 Vercel 一致

## 部署（Vercel + Turso）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zephyr110/financial-news)

1. [Turso](https://turso.tech) 创建数据库
2. Vercel 配置环境变量：`LLM_API_KEY`、`CRON_SECRET`、`TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN`
3. GitHub Actions Secrets 配置 `APP_URL` 和 `CRON_SECRET`
4. Redeploy

首次部署后手动触发一次 fetch + analyze 初始化数据。

## License

[MIT](LICENSE)
