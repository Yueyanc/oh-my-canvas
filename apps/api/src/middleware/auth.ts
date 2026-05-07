import { createMiddleware } from "hono/factory";
import { getRequestSession } from "../auth/session";

const publicApiPaths = new Set(["/api/health", "/api/auth/login", "/api/auth/logout", "/api/auth/me"]);

export function requireAuth() {
  return createMiddleware(async (c, next) => {
    const path = new URL(c.req.url).pathname;
    if (publicApiPaths.has(path)) return next();

    const session = getRequestSession(c);
    if (!session) return c.json({ error: "Unauthorized" }, 401);

    return next();
  });
}
