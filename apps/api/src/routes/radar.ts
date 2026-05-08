import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { loadRadarConfig } from "@information/core";
import { getAiTokenUsageSummary, getRadarOverview, listItems, listRuns, type AppDb } from "@information/db";
import { runCollection } from "../scheduler";

export function createRadarRoutes(db: AppDb) {
  const routes = new Hono();

  routes.get(
    "/items",
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

  routes.get("/runs", async (c) => {
    const runs = await listRuns(db);
    return c.json({ runs });
  });

  routes.get(
    "/radar/overview",
    zValidator(
      "query",
      z.object({
        perSourceLimit: z.coerce.number().min(1).max(30).optional(),
        globalLimit: z.coerce.number().min(1).max(50).optional()
      })
    ),
    async (c) => {
      const query = c.req.valid("query");
      const overview = await getRadarOverview(db, query);
      return c.json(overview);
    }
  );

  routes.get("/config", async (c) => {
    const config = await loadRadarConfig();
    return c.json(config);
  });

  routes.post("/collect", async (c) => {
    const result = await runCollection(db, "manual");
    return c.json(result);
  });

  routes.get("/usage/tokens", async (c) => {
    const windows = await getAiTokenUsageSummary(db);
    return c.json({ windows });
  });

  return routes;
}
