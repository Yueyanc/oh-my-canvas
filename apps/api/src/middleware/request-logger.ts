import { createMiddleware } from "hono/factory";
import { createChildLogger } from "@template/logger";

const log = createChildLogger("api");

export function requestLogger() {
  return createMiddleware(async (c, next) => {
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
}
