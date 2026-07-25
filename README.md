# Financial News

财经新闻聚合 + **政策-行业影响分析引擎** — Next.js + ISR，Turso/SQLite 归档，DeepSeek 信号筛选。

## 功能

- 新浪 / 东方财富 7×24 快讯抓取，智能过滤与去重归档
- AI 信号筛选（DeepSeek）：政策 / 行业 / 地缘 / 公司 / 宏观打分（1–5）
- 分析面板 `/analysis`：信号时间线、概览统计、分类与行业标签
- 首页实时资讯：暗色模式、下拉刷新、响应式布局
- RSS 2.0 / JSON Feed 订阅

## 技术栈

Next.js 16 (Pages Router) · Tailwind CSS v4 · shadcn/ui · Turso (libSQL) · DeepSeek API

## 开发

```bash
npm install
npm run dev      # http://localhost:3000  ·  分析面板 /analysis
npm run build
npm start
```

未配置 Turso 时，本地默认使用项目根目录的 `news_archive.db` 文件。

本地触发归档 / 分析（需 `DEEPSEEK_API_KEY`）：

```bash
curl "http://localhost:3000/api/cron/fetch"
curl "http://localhost:3000/api/cron/analyze"
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | 本地 `npm run dev` / 分析管道必需 |
| `CRON_SECRET` | 生产 / Vercel 必需，保护 cron 端点 |
| `TURSO_DATABASE_URL` | 生产必需；本地可选（未设则用本地 SQLite 文件） |
| `TURSO_AUTH_TOKEN` | 配合 Turso URL 的鉴权 token |
| `NEWS_DB_PATH` | 可选，仅本地文件模式的 SQLite 路径 |

## Cron 端点

需带 `?token=<CRON_SECRET>`（生产环境强制校验）：

| 端点 | 作用 |
|------|------|
| `GET /api/cron/fetch` | 双源新闻归档 |
| `GET /api/cron/analyze` | LLM 信号分析 |
| `GET /api/cron/stats` | 用量与 DB 统计 |

公开只读：`GET /api/analysis?hoursBack=24&minScore=1`

## 部署（Vercel + Turso）

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zephyr110/financial-news)

1. 在 [Turso](https://turso.tech) 创建数据库，拿到 URL 与 token
2. Vercel Environment Variables 配置：
   - `DEEPSEEK_API_KEY`
   - `CRON_SECRET`
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
3. 配置定时任务（二选一）：
   - **Vercel Cron**：本仓库 `vercel.json` 已配置（Hobby 计划最多每天 1 次：UTC 0:00 fetch、0:30 analyze）
   - **更频繁**：升级 Pro 后把 schedule 改成 `*/5` / `*/10`，或用外部 cron 调  
     `https://你的域名/api/cron/fetch?token=<CRON_SECRET>`
4. Redeploy

历史新闻与分析结果持久保存在 Turso，分析面板可跨实例正常使用。

首次上线后建议手动触发一次 fetch + analyze，确认 `/analysis` 有数据。

## License

[MIT](LICENSE)。
