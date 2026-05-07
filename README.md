# Information Radar

A lightweight TrendRadar-inspired information radar built with Bun, Hono, Drizzle, SQLite, and Vite React.

## Stack

- Bun runtime and package manager
- Hono API server
- Drizzle ORM with Bun SQLite
- SQLite local database
- Vite + React dashboard
- TypeScript shared packages

## Quick Start

Install Bun first, then:

```bash
bun install
cp .env.example .env
cp config/sources.example.json config/sources.json
bun run db:push
```

Run the API and web app in two terminals:

```bash
bun run dev:api
bun run dev:web
```

Open the dashboard at `http://localhost:5173`.

## First Collection

Trigger collection from the dashboard, or run:

```bash
bun run collect
```

The default sources include NewsNow hot lists, RSS, GitHub search, and Hacker News. Edit `config/sources.json` to change keywords, source weights, and endpoints.

## NewsNow Sources

Use `type: "newsnow"` when you want TrendRadar-style hot-list collection through the NewsNow API:

```json
{
  "id": "newsnow-weibo",
  "type": "newsnow",
  "name": "Weibo Hot",
  "enabled": true,
  "query": "weibo",
  "weight": 8
}
```

`query` is the NewsNow platform id. `url` is optional and defaults to `https://newsnow.busiyi.world/api/s`, so you can point it at a self-hosted NewsNow instance later.

The default config enables `weibo`, `zhihu`, and `baidu`. It also includes disabled presets for `douyin`, `bilibili`, `toutiao`, `thepaper`, and `ithome`; flip `enabled` to `true` when you want broader coverage.

## Environment

```bash
DATABASE_URL=file:data/radar.sqlite
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
AUTO_COLLECT_ENABLED=true
AUTO_COLLECT_INTERVAL_MS=120000
AI_CLASSIFY_MAX_PER_RUN=120
AI_CLASSIFY_MIN_SCORE=0
LOG_LEVEL=info
LOG_DIR=logs
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14d
```

AI summaries are optional. If no API key is configured, the system falls back to concise rule-based summaries.

## Auto Collection

The API server starts an in-process collector by default. It runs every two minutes:

```text
AUTO_COLLECT_ENABLED=true
AUTO_COLLECT_INTERVAL_MS=120000
```

Manual collection and scheduled collection share one lock, so overlapping runs are skipped. Check scheduler state at:

```text
GET /api/scheduler
GET /api/health
```

## Scoring

Items use a 100-point rule score before AI ranking:

```text
score =
  rank * 0.30
  + engagement * 0.20
  + freshness * 0.15
  + persistence * 0.15
  + source * 0.10
  + keyword * 0.10
```

`persistence` combines same-item recurrence and event clustering. Same-item recurrence uses the previous record for the same URL. Event clustering uses lightweight title tokens, including English words and Chinese 2-3 character n-grams, to detect similar stories across sources within a recent time window. Each item stores its component scores in `metricsJson.scoreBreakdown`.

## Storage And Trends

`items` stores the latest known state for each unique URL. `item_observations` appends one immutable snapshot every time an item is collected:

```text
items
  current title, url, source, score, firstSeenAt, lastSeenAt

item_observations
  itemId, runId, observedAt, rank, hot, engagement, score, scoreBreakdownJson, metricsJson
```

The API calculates a lightweight trend summary from the latest 72 hours of observations:

```text
new      first observation only
rising   score velocity >= 8 or rank improves by 3+
cooling  score velocity <= -8 or rank drops by 3+
stable   still visible without major movement
expired  not observed for 180+ minutes
```

Dashboard cards show `status`, score velocity, and peak time.

## Incremental AI Classification

AI classification runs incrementally after each collection. It does not reprocess every item every two minutes. Candidates are selected when they are new, unclassified, their input hash changed, or their score is high enough to deserve another look.

Default limits:

```text
AI_CLASSIFY_MIN_SCORE=0
AI_CLASSIFY_MAX_PER_RUN=120
```

Classification results are stored in `ai_classifications`:

```text
itemId, model, category, subCategory, relevanceScore, isNoise,
summary, reason, inputHash, classifiedAt, expiresAt
```

Without `OPENAI_API_KEY`, the system uses a rule-based fallback so category filtering still works.

## Logging

The app uses Winston with local daily rotated files. Logs are written to `logs/` by default:

```text
logs/app-YYYY-MM-DD.log
logs/error-YYYY-MM-DD.log
logs/exceptions-YYYY-MM-DD.log
logs/rejections-YYYY-MM-DD.log
```

Configure it with:

```text
LOG_LEVEL=info
LOG_DIR=logs
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14d
```

Logs include API requests, scheduler activity, source collection results, scoring counts, AI classification counts, and collection failures.

## Token Usage

AI token usage is stored locally in `ai_token_usage` whenever the model provider returns usage data. The dashboard shows rolling totals for:

```text
5 minutes, 15 minutes, 30 minutes, 1 hour, 5 hours, 12 hours, 1 day, 7 days
```

The API endpoint is:

```text
GET /api/usage/tokens
```

Only model calls made after this feature is enabled are counted; older classifications are not backfilled.

## Project Layout

```text
apps/
  api/        Hono API server
  web/        Vite React dashboard
packages/
  core/       collectors, scoring, ingestion, summarization
  db/         Drizzle schema and repositories
config/       source and rule configuration
data/         local SQLite database
```
