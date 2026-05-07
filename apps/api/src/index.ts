import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { loadRadarConfig } from "@information/core";
import { createDb, getAiTokenUsageSummary, listItems, listRuns } from "@information/db";
import { createChildLogger, errorMeta } from "@information/logger";
import { getSchedulerState, runCollection, startAutoCollector } from "./scheduler";

const app = new Hono();
const db = createDb();
const log = createChildLogger("api");
const sessionCookie = "information_session";
const sessionTtlSeconds = 7 * 24 * 60 * 60;
const sessions = new Map<string, { username: string; expiresAt: number }>();
const authUsername = process.env.AUTH_USERNAME ?? process.env.ADMIN_USERNAME ?? "admin";
const authPassword = process.env.AUTH_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "admin123";
const publicApiPaths = new Set(["/api/health", "/api/auth/login", "/api/auth/logout", "/api/auth/me"]);

app.use("*", cors());
app.use("*", async (c, next) => {
  const startedAt = performance.now();
  const requestId = crypto.randomUUID();
  c.header("x-request-id", requestId);
  try {
    await next();
  } finally {
    log.info("request completed", {
      requestId,
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10
    });
  }
});

app.use("/api/*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (publicApiPaths.has(path)) return next();

  const session = getValidSession(getCookie(c, sessionCookie));
  if (!session) return c.json({ error: "Unauthorized" }, 401);

  return next();
});

app.post(
  "/api/auth/login",
  zValidator(
    "json",
    z.object({
      username: z.string().min(1),
      password: z.string().min(1)
    })
  ),
  async (c) => {
    const body = c.req.valid("json");
    if (body.username !== authUsername || body.password !== authPassword) {
      return c.json({ error: "Invalid username or password" }, 401);
    }

    const token = crypto.randomUUID();
    sessions.set(token, { username: authUsername, expiresAt: Date.now() + sessionTtlSeconds * 1000 });
    setCookie(c, sessionCookie, token, {
      httpOnly: true,
      maxAge: sessionTtlSeconds,
      path: "/",
      sameSite: "Lax",
      secure: process.env.NODE_ENV === "production"
    });

    return c.json({ user: { username: authUsername } });
  }
);

app.get("/api/auth/me", (c) => {
  const session = getValidSession(getCookie(c, sessionCookie));
  return c.json({
    authenticated: Boolean(session),
    user: session ? { username: session.username } : null
  });
});

app.post("/api/auth/logout", (c) => {
  const token = getCookie(c, sessionCookie);
  if (token) sessions.delete(token);
  deleteCookie(c, sessionCookie, { path: "/" });
  return c.json({ ok: true });
});

app.get("/api/health", (c) =>
  c.json({
    ok: true,
    runtime: "bun",
    time: new Date().toISOString(),
    scheduler: getSchedulerState()
  })
);

app.get(
  "/api/items",
  zValidator(
    "query",
    z.object({
      limit: z.coerce.number().min(1).max(200).optional(),
      sourceType: z.string().optional(),
      sourceId: z.string().optional(),
      category: z.string().optional(),
      q: z.string().optional(),
      since: z.string().optional()
    })
  ),
  async (c) => {
    const query = c.req.valid("query");
    const items = await listItems(db, query);
    return c.json({ items });
  }
);

app.get("/api/runs", async (c) => {
  const runs = await listRuns(db);
  return c.json({ runs });
});

app.get("/api/config", async (c) => {
  const config = await loadRadarConfig();
  return c.json(config);
});

app.post("/api/collect", async (c) => {
  const result = await runCollection(db, "manual");
  return c.json(result);
});

app.get("/api/scheduler", (c) => c.json(getSchedulerState()));

app.get("/api/usage/tokens", async (c) => {
  const windows = await getAiTokenUsageSummary(db);
  return c.json({ windows });
});

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((error, c) => {
  log.error("request failed", {
    ...errorMeta(error),
    method: c.req.method,
    path: new URL(c.req.url).pathname
  });
  return c.json({ error: "Internal server error" }, 500);
});

export default {
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch
};

startAutoCollector(db);
log.info("api server configured", { port: Number(process.env.PORT ?? 3000), scheduler: getSchedulerState() });

function getValidSession(token?: string) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}
