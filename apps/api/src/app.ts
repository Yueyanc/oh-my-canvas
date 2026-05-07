import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppDb } from "@information/db";
import { createChildLogger, errorMeta } from "@information/logger";
import { requireAuth } from "./middleware/auth";
import { requestLogger } from "./middleware/request-logger";
import { createAuthRoutes } from "./routes/auth";
import { createRadarRoutes } from "./routes/radar";
import { createSystemRoutes } from "./routes/system";

const log = createChildLogger("api");

export function createApiApp(db: AppDb) {
  const app = new Hono();

  app.use("*", cors());
  app.use("*", requestLogger());
  app.use("/api/*", requireAuth());

  app.route("/api/auth", createAuthRoutes());
  app.route("/api", createSystemRoutes());
  app.route("/api", createRadarRoutes(db));

  app.notFound((c) => c.json({ error: "Not found" }, 404));
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
