import { Hono } from "hono";
import { getSchedulerState } from "../scheduler";

export function createSystemRoutes() {
  const routes = new Hono();

  routes.get("/health", (c) =>
    c.json({
      ok: true,
      runtime: "bun",
      time: new Date().toISOString(),
      scheduler: getSchedulerState()
    })
  );

  routes.get("/scheduler", (c) => c.json(getSchedulerState()));

  return routes;
}
