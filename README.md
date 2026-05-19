# Project Template

A minimal full-stack Bun template with:

- Hono API server
- SQLite + Drizzle
- Cookie-based authentication
- Default admin account bootstrap
- Protected API middleware
- Vite React dashboard shell
- Account profile and password settings
- Theme, font, and sidebar controls

## Quick Start

```bash
bun install
cp .env.example .env
bun run db:push
bun run dev
```

Default login:

```txt
admin / admin123
```

## Scripts

```bash
bun run dev        # start API and web dev servers
bun run dev:api    # API only
bun run dev:web    # web only
bun run db:push    # sync Drizzle schema to SQLite
bun run typecheck  # TypeScript check
bun run build      # production web build
```

## Structure

```txt
apps/api      Hono API, auth routes, session middleware
apps/web      Vite React dashboard
packages/db   Drizzle schema and SQLite client
packages/logger shared logging
```

## Environment

```env
DATABASE_URL=file:data/app.sqlite
PORT=8787
AUTH_USERNAME=admin
AUTH_PASSWORD=admin123
```

All `/api/*` routes are protected by default except health and auth endpoints.
