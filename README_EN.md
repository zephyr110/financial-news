# Financial Signals

Real-time financial news aggregation + **Policy-Industry Impact Analysis Engine** — Next.js + ISR, Turso/SQLite archiving, AI-powered signal detection.

## Features

- **Dual-source news archiving** — Sina + Eastmoney 7×24 ticker auto-collection with dedup and keyword filtering
- **AI signal scoring** — LLM scores every news item (1–5), classifying into policy / geopolitics / industry / company / macro categories
- **Analysis dashboard** `/analysis` — signal strength cards, industry bar chart, category donut chart, industry trend line chart, keyword cloud, signal timeline
- **Live news feed** — date-grouped timeline, pull-to-refresh, dark mode, responsive layout
- **RSS 2.0 / JSON Feed**

## Tech Stack

Next.js 16 (Pages Router) · Tailwind CSS v4 · shadcn/ui · Recharts · Turso (libSQL) · OpenAI-compatible LLM API

## Development

```bash
pnpm install
pnpm dev      # http://localhost:3000  →  Analysis dashboard at /analysis
pnpm build
pnpm start
```

Without Turso configured, a local `news_archive.db` SQLite file is used by default.

Manually trigger archive / analysis (requires LLM API key):

```bash
curl "http://localhost:3000/api/cron/fetch"
curl "http://localhost:3000/api/cron/analyze"
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLM_API_KEY` | LLM API key | — |
| `LLM_BASE_URL` | Chat completions endpoint | `https://api.deepseek.com/v1` |
| `LLM_MODEL` | Model name | `deepseek-v4-flash` |
| `DEEPSEEK_API_KEY` | Fallback for `LLM_API_KEY` | — |
| `CRON_SECRET` | Protects cron endpoints | — |
| `TURSO_DATABASE_URL` | Turso database URL (production) | — |
| `TURSO_AUTH_TOKEN` | Turso auth token | — |
| `NEWS_DB_PATH` | Local SQLite file path | `news_archive.db` |

### Switching LLM Providers

```bash
# OpenAI
LLM_BASE_URL=https://api.openai.com LLM_MODEL=gpt-4o LLM_API_KEY=sk-...

# Any OpenAI-compatible service
LLM_BASE_URL=https://your-endpoint LLM_MODEL=your-model LLM_API_KEY=your-key
```

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/cron/fetch` | Archive news from all sources (auth required) |
| `GET /api/cron/analyze` | Run LLM signal analysis (auth required) |
| `GET /api/cron/stats` | Usage statistics & DB counts (auth required) |
| `GET /api/analysis?hoursBack=24&minScore=1&trendHours=168` | Analysis data (public) |
| `GET /api/news` | Archived news (public) |
| `GET /api/rss.xml` | RSS 2.0 feed |
| `GET /api/rss.json` | JSON Feed |

## Scheduling

GitHub Actions triggers fetch + analyze hourly (`.github/workflows/cron.yml`).

Required GitHub Secrets:
- `APP_URL` — deployment domain
- `CRON_SECRET` — same as Vercel environment variable

## Deployment (Vercel + Turso)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/zephyr110/financial-news)

1. Create a database on [Turso](https://turso.tech)
2. Set Vercel environment variables: `LLM_API_KEY`, `CRON_SECRET`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
3. Configure GitHub Actions Secrets: `APP_URL`, `CRON_SECRET`
4. Redeploy

After initial deployment, manually trigger fetch + analyze once to seed the database.

## License

[MIT](LICENSE)
