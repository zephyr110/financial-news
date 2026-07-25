<p align="right"><a href="./README.md">English</a></p>

# 财经信号

AI 驱动的财经新闻聚合与信号分析引擎。

![首页](https://raw.githubusercontent.com/zephyr110/blog-img/main/financial-signals-homepage.png)

## 功能概览

- **双源新闻归档** — 新浪 + 东方财富 7×24 快讯自动采集、过滤、去重
- **AI 信号评分** — LLM 对每条新闻打分（1–5），分为政策、地缘、行业、公司、宏观六类
- **可视化分析** — 图表、趋势线、词云、可筛选的时间线
- **RSS 订阅** — 支持 RSS 2.0 / JSON Feed

## 分析面板

![分析面板](https://raw.githubusercontent.com/zephyr110/blog-img/main/financial-signals-analysis.png)

`/analysis` 页面提供：
- **信号强度卡片** — 四张渐变卡片，点击可筛选时间线
- **行业信号分布** — 横向柱状图，展示 Top 行业信号量
- **信号分类占比** — 环形图，按政策/行业/公司等分类
- **行业热度趋势** — 多线折线图，支持 24h / 周 / 月 / 年 / 自定义时间跨度
- **焦点热词** — 基于 LLM 识别的行业关键词词云
- **信号时间线** — 可按分数、卡片筛选的完整信号列表

## 技术栈

Next.js 16 (Pages Router) · Tailwind CSS v4 · shadcn/ui · Recharts · Turso (libSQL) · OpenAI-compatible LLM API

## 快速开始

```bash
pnpm install
pnpm dev      # http://localhost:3000 → 分析面板 /analysis
pnpm build
pnpm start
```

未配置 Turso 时自动使用本地 `news_archive.db` SQLite 文件。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LLM_API_KEY` | LLM API 密钥 | — |
| `LLM_BASE_URL` | Chat Completions 端点 | `https://api.deepseek.com/v1` |
| `LLM_MODEL` | 模型名称 | `deepseek-v4-flash` |
| `CRON_SECRET` | 保护 cron 端点 | — |
| `TURSO_DATABASE_URL` | Turso 数据库地址 | — |
| `TURSO_AUTH_TOKEN` | Turso 鉴权 token | — |

更换 `LLM_BASE_URL`、`LLM_MODEL`、`LLM_API_KEY` 即可切换 LLM 提供商。

## API

| 端点 | 说明 |
|------|------|
| `GET /api/cron/fetch` | 双源新闻归档（需鉴权） |
| `GET /api/cron/analyze` | LLM 信号分析（需鉴权） |
| `GET /api/cron/stats` | 用量与 DB 统计（需鉴权） |
| `GET /api/analysis` | 分析数据（公开） |
| `GET /api/news` | 归档新闻（公开） |
| `GET /api/rss.xml` | RSS 2.0 |
| `GET /api/rss.json` | JSON Feed |

## 定时调度

GitHub Actions 每小时触发 fetch + analyze（`.github/workflows/cron.yml`）。需配置 GitHub Secrets：`APP_URL`、`CRON_SECRET`。

## 部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zephyr110/financial-news)

1. [Turso](https://turso.tech) 创建数据库
2. Vercel 配置环境变量：`LLM_API_KEY`、`CRON_SECRET`、`TURSO_DATABASE_URL`、`TURSO_AUTH_TOKEN`
3. GitHub Actions Secrets 配置：`APP_URL`、`CRON_SECRET`
4. 首次部署后手动触发一次 fetch + analyze 初始化数据

## License

[MIT](LICENSE)
