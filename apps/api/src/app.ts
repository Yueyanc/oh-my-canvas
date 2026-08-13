import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppDb } from "@oh-my-canvas/db/runtime";
import { createChildLogger, errorMeta } from "@oh-my-canvas/logger";
import { requireAuth } from "./middleware/auth";
import { requestLogger } from "./middleware/request-logger";
import { createAuthRoutes } from "./routes/auth";
import { createSystemRoutes } from "./routes/system";

const log = createChildLogger("api");

export function createApiApp(db: AppDb, options: { includeNotFound?: boolean } = {}) {
  const app = new Hono();

  app.use("*", cors());
  app.use("*", requestLogger());
  app.use("/api/*", requireAuth(db));

  app.route("/api/auth", createAuthRoutes(db));
  app.route("/api", createSystemRoutes());

  if (options.includeNotFound !== false) {
    app.notFound((c) => c.json({ error: "Not found" }, 404));
  }
  app.onError((error, c) => {
    log.error("request failed", {
      ...errorMeta(error),
      method: c.req.method,
      path: new URL(c.req.url).pathname
    });
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}
