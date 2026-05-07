import { collectGithub } from "./github";
import { collectHackerNews } from "./hackernews";
import { collectNewsNow } from "./newsnow";
import { collectRss } from "./rss";
import type { CollectedItem, SourceConfig } from "../types";

export async function collectSource(source: SourceConfig): Promise<CollectedItem[]> {
  if (source.type === "rss") return collectRss(source);
  if (source.type === "github") return collectGithub(source);
  if (source.type === "hackernews") return collectHackerNews(source);
  if (source.type === "newsnow") return collectNewsNow(source);
  return [];
}
