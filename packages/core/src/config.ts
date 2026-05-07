import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { RadarConfig } from "./types";

const sourceSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["rss", "github", "hackernews", "newsnow"]),
  name: z.string().min(1),
  enabled: z.boolean().default(true),
  weight: z.number().optional(),
  url: z.string().url().optional(),
  query: z.string().optional()
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
