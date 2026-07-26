<p align="right"><a href="./README_CN.md">中文</a></p>

# Financial Signals

AI-powered financial news aggregation & signal analysis engine.

![Homepage](https://raw.githubusercontent.com/zephyr110/blog-img/main/financial-signals-homepage.png)

## What It Does

- **Aggregates** real-time financial news from Sina, 10jqka, Wallstreetcn
- **Scores** every news item (1–5) with an LLM — policy, geopolitics, industry, company, macro
- **Visualizes** signals with charts, trend lines, word clouds, and a filterable timeline
- **Analyzes** market impact via backtest engine comparing signals to sector returns
- **Notifies** via browser push when critical signals (≥4) appear
- **Delivers** RSS 2.0 / JSON Feed for subscription

## Analysis Dashboard

![Analysis](https://raw.githubusercontent.com/zephyr110/blog-img/main/financial-signals-analysis.png)

The `/analysis` page provides:
- **Signal strength cards** — gradient cards with click-to-filter
- **Industry bar chart** — top sectors by signal count
- **Category donut chart** — policy vs industry vs company distribution
- **Trend line chart** — industry attention trends (24h / week / month / year / custom)
- **Keyword cloud** — weighted multi-source (tags × industries × categories × companies)
- **Event threads** — LLM-detected narrative clusters with stage/confidence
- **Signal timeline** — filterable by score, category, and watched industries

## Tech Stack

Next.js 16 (Pages Router) · TypeScript 5.9 · Tailwind CSS v4 · shadcn/ui · Recharts · Turso (libSQL) · Vitest · Husky

## Quick Start

```bash
pnpm install
pnpm dev        # http://localhost:3000 → Analysis at /analysis
pnpm build
pnpm start
pnpm test       # 39 tests
pnpm typecheck  # tsc --noEmit
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_API_KEY` | LLM API key | — |
| `LLM_BASE_URL` | Chat completions endpoint | `https://api.deepseek.com/v1` |
| `LLM_MODEL` | Model name | `deepseek-v4-flash` |
| `CRON_SECRET` | Protects cron endpoints | — |
| `TURSO_DATABASE_URL` | Turso DB URL (production) | — |
| `TURSO_AUTH_TOKEN` | Turso auth token | — |

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/cron/fetch` | Archive news from all sources (auth) |
| `GET /api/cron/analyze` | LLM signal scoring (auth) |
| `GET /api/cron/deep-analyze` | Deep entity mapping (auth) |
| `GET /api/cron/event-threads` | Event thread detection (auth) |
| `GET /api/cron/fetch-market` | Market data + backtest (auth) |
| `GET /api/cron/stats` | Usage & DB stats (auth) |
| `GET /api/analysis` | Analysis data (public) |
| `GET /api/backtest` | Backtest summary (public) |
| `GET /api/news` | Archived news (public) |
| `GET /api/rss.xml` | RSS 2.0 |
| `GET /api/rss.json` | JSON Feed |

## Scheduling

GitHub Actions hourly pipeline: `fetch → analyze → deep-analyze → event-threads → fetch-market`

GitHub Secrets required: `APP_URL`, `CRON_SECRET`

## Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zephyr110/financial-news)

1. Create a database on [Turso](https://turso.tech)
2. Set Vercel env vars: `LLM_API_KEY`, `CRON_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
3. Configure GitHub Secrets: `APP_URL`, `CRON_SECRET`
4. Manually trigger fetch + analyze once to seed initial data

## License

[MIT](LICENSE)
