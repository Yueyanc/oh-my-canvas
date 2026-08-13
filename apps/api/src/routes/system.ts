import { Hono } from "hono";

export function createSystemRoutes() {
  const routes = new Hono();

  routes.get("/health", (c) =>
    c.json({
      ok: true,
      runtime: typeof Bun === "undefined" ? "node" : "bun",
      time: new Date().toISOString()
    })
  );

  return routes;
}
