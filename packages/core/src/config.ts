import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { RadarConfig } from "./types";

const sourceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["rss", "github", "hackernews", "newsnow"]),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  schedule: z.enum(["default", "github-daily", "github-weekly"]).default("default"),
  weight: z.number().optional(),
  url: z.string().url().optional(),
  query: z.string().optional(),
  since: z.enum(["daily", "weekly", "monthly"]).optional(),
  feed: z.enum(["topstories", "newstories", "beststories", "askstories", "showstories", "jobstories"]).optional(),
  limit: z.number().int().positive().max(500).optional(),
  comments: z
    .object({
      enabled: z.boolean().default(false),
      maxTopLevel: z.number().int().positive().max(50).optional(),
      maxDepth: z.number().int().min(1).max(5).optional(),
      maxTotal: z.number().int().positive().max(300).optional()
    })
    .optional()
});

const configSchema = z.object({
  rules: z.object({
    keywords: z.array(z.string()).default([]),
    blocklist: z.array(z.string()).default([]),
    sourceWeights: z
      .object({
        rss: z.number().optional(),
        github: z.number().optional(),
        hackernews: z.number().optional(),
        newsnow: z.number().optional()
      })
      .default({})
  }),
  sources: z.array(sourceSchema)
});

export async function loadRadarConfig(path = "config/sources.json"): Promise<RadarConfig> {
  const text = await readFile(path, "utf8");
  return configSchema.parse(JSON.parse(text));
}
