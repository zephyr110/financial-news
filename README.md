# Financial News

财经新闻聚合 + **政策-行业影响分析引擎** — Next.js + ISR，SQLite 归档，DeepSeek 信号筛选。

## 功能

- 新浪 / 东方财富 7×24 快讯抓取，智能过滤与去重归档
- AI 信号筛选（DeepSeek）：政策 / 行业 / 地缘 / 公司 / 宏观打分（1–5）
- 分析面板 `/analysis`：信号时间线、概览统计、分类与行业标签
- 首页实时资讯：暗色模式、下拉刷新、响应式布局
- RSS 2.0 / JSON Feed 订阅

## 技术栈

Next.js 16 (Pages Router) · Tailwind CSS v4 · shadcn/ui · better-sqlite3 · DeepSeek API

## 开发

```bash
npm install
npm run dev      # http://localhost:3000  ·  分析面板 /analysis
npm run build
npm start
```

本地触发归档 / 分析（需 `DEEPSEEK_API_KEY`）：

```bash
# 例如通过 cron 端点或直接调用 lib
curl "http://localhost:3000/api/cron/fetch"
curl "http://localhost:3000/api/cron/analyze"
```

## 环境变量

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | 分析管道必需 |
| `CRON_SECRET` | 生产 / Vercel 必需，保护 cron 端点 |
| `NEWS_DB_PATH` | 可选，SQLite 路径；Vercel 未设置时使用 `/tmp`（不持久） |

## Cron 端点

需带 `?token=<CRON_SECRET>`（生产环境强制校验）：

| 端点 | 作用 |
|------|------|
| `GET /api/cron/fetch` | 双源新闻归档 |
| `GET /api/cron/analyze` | LLM 信号分析 |
| `GET /api/cron/stats` | 用量与 DB 统计 |

公开只读：`GET /api/analysis?hoursBack=24&minScore=1`

## 部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zephyr110/financial-news)

1. 配置 `DEEPSEEK_API_KEY`、`CRON_SECRET`
2. 配置 Vercel Cron 指向 `/api/cron/fetch` 与 `/api/cron/analyze`
3. **注意**：Serverless 上 SQLite 默认写 `/tmp`，冷启动会丢数据；生产持久化请设置可写的 `NEWS_DB_PATH` 或改用外部 DB（如 Turso）

## License

见 [LICENSE](LICENSE)。
