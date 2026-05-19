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

The default source is Hacker News through the official Firebase API. Edit `config/sources.json` to change keywords, source weights, feed, and item limit.

## Hacker News Sources

Use `type: "hackernews"` when you want Hacker News data from the official Firebase API:

```json
{
  "id": "hn-top",
  "type": "hackernews",
  "name": "Hacker News Top Stories",
  "enabled": true,
  "feed": "topstories",
  "limit": 30,
  "comments": {
    "enabled": true,
    "maxTopLevel": 8,
    "maxDepth": 2,
    "maxTotal": 40
  },
  "weight": 8
}
```

Supported feeds are `topstories`, `newstories`, `beststories`, `askstories`, `showstories`, and `jobstories`. The collector first reads the feed id list, then fetches each item from `/item/<id>.json`.

Collected HN comments are stored in `metricsJson.hnDiscussion`. When `AI_DISCUSSION_ENABLED=true`, the model writes a Chinese discussion digest into `metricsJson.aiDiscussionDigest`, including summary, key insights, risks, stances, featured comments, and discussion signal scores.

## Environment

```bash
DATABASE_URL=file:data/radar.sqlite
OPENAI_API_KEY=
OPENAI_BASE_URL=https://s2a.yueyanc.cn/v1
OPENAI_MODEL=gpt-5.4-mini
AI_QUALITY_ENABLED=true
AI_QUALITY_MAX_PER_RUN=30
AI_DISCUSSION_ENABLED=true
AI_DISCUSSION_MAX_PER_RUN=8
AI_DISCUSSION_MAX_COMMENTS=30
OPENROUTER_API_KEY=
EMBEDDING_PROVIDER=openrouter
EMBEDDING_MODEL=openai/text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
PORT=8787
AUTO_COLLECT_ENABLED=true
AUTO_COLLECT_INTERVAL_MS=43200000
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
AUTO_COLLECT_INTERVAL_MS=43200000
```

Manual collection and scheduled collection share one lock, so overlapping runs are skipped. Check scheduler state at:

```text
GET /api/scheduler
GET /api/health
```

## Scoring

Items use a quality-first scorecard. The top-level `items.score` is the information quality score, not a heat score. Display ranking is stored separately in `metricsJson.scoreBreakdown.ranking.score`.

```text
quality_score =
  factuality        * 0.25
  + sourceReputation * 0.20
  + evidenceStrength * 0.20
  + completeness      * 0.15
  + objectivity       * 0.10
  + clarity           * 0.05
  + freshnessFit      * 0.05

ranking_score =
  quality_score * 0.50
  + relevance   * 0.25
  + freshness   * 0.15
  + popularity  * 0.10
```

Each score breakdown stores:

- `quality`: score, confidence, verdict, dimensions, flags, and rationale.
- `ranking`: quality-weighted display ranking.
- `evidence`: source URL, extracted claim placeholder, citations, and check time.
- legacy signal fields such as `relevanceScore`, `freshnessScore`, `engagementScore`, and `eventCluster` for dashboards and trend calculations.

Embedding defaults to OpenRouter with `openai/text-embedding-3-small`. The provider also supports generic OpenAI-compatible HTTP responses with `data[].embedding` or `{ "embeddings": [...] }`.

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
