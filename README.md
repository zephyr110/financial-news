<p align="right"><a href="./README_CN.md">中文</a></p>

# Financial Signals

AI-powered financial news aggregation & signal analysis engine.

![Homepage](https://raw.githubusercontent.com/zephyr110/blog-img/main/financial-signals-homepage.png)

## What It Does

- **Aggregates** real-time financial news from Sina 7×24 tickers
- **Scores** every news item (1–5) with an LLM — policy, geopolitics, industry, company, macro
- **Visualizes** signals with charts, trend lines, word clouds, and a filterable timeline
- **Delivers** RSS 2.0 / JSON Feed for subscription

## Analysis Dashboard

![Analysis](https://raw.githubusercontent.com/zephyr110/blog-img/main/financial-signals-analysis.png)

The `/analysis` page provides:
- **Signal strength cards** — at-a-glance summary with click-to-filter
- **Industry distribution** — horizontal bar chart of top industries
- **Category breakdown** — donut chart by signal category
- **Trend line chart** — industry attention trends (24h / week / month / year / custom range)
- **Keyword cloud** — most frequently mentioned terms
- **Signal timeline** — filterable, scrollable list of every scored news item

## Tech Stack

Next.js 16 (Pages Router) · Tailwind CSS v4 · shadcn/ui · Recharts · Turso (libSQL) · OpenAI-compatible LLM API

## Quick Start

```bash
pnpm install
pnpm dev      # http://localhost:3000 → Analysis at /analysis
pnpm build
pnpm start
```

Without Turso, a local `news_archive.db` SQLite file is used automatically.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_API_KEY` | LLM API key | — |
| `LLM_BASE_URL` | Chat completions endpoint | `https://api.deepseek.com/v1` |
| `LLM_MODEL` | Model name | `deepseek-v4-flash` |
| `CRON_SECRET` | Protects cron endpoints | — |
| `TURSO_DATABASE_URL` | Turso DB URL (production) | — |
| `TURSO_AUTH_TOKEN` | Turso auth token | — |

Switch LLM providers by changing `LLM_BASE_URL`, `LLM_MODEL`, and `LLM_API_KEY`.

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/cron/fetch` | Archive news from all sources (auth) |
| `GET /api/cron/analyze` | Run LLM signal analysis (auth) |
| `GET /api/cron/stats` | Usage & DB stats (auth) |
| `GET /api/analysis` | Analysis data (public) |
| `GET /api/news` | Archived news (public) |
| `GET /api/rss.xml` | RSS 2.0 |
| `GET /api/rss.json` | JSON Feed |

## Scheduling

GitHub Actions triggers fetch + analyze hourly (`.github/workflows/cron.yml`). Requires `APP_URL` and `CRON_SECRET` as GitHub Secrets.

## Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zephyr110/financial-news)

1. Create a database on [Turso](https://turso.tech)
2. Set Vercel env vars: `LLM_API_KEY`, `CRON_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
3. Configure GitHub Actions Secrets: `APP_URL`, `CRON_SECRET`
4. Manually trigger fetch + analyze once to seed initial data

## License

[MIT](LICENSE)
