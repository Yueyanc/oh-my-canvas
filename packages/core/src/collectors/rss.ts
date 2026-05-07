import { XMLParser } from "fast-xml-parser";
import type { CollectedItem, SourceConfig } from "../types";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: true
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "#text" in value) return String(value["#text" as keyof typeof value]);
  return undefined;
}

export async function collectRss(source: SourceConfig): Promise<CollectedItem[]> {
  if (!source.url) throw new Error(`RSS source ${source.id} requires url`);
  const response = await fetch(source.url);
  if (!response.ok) throw new Error(`RSS fetch failed for ${source.name}: ${response.status}`);
  const xml = await response.text();
  const parsed = parser.parse(xml);
  const channelItems = asArray(parsed.rss?.channel?.item);
  const atomItems = asArray(parsed.feed?.entry);

  return [...channelItems, ...atomItems]
    .map((entry: any) => {
      const link = typeof entry.link === "string" ? entry.link : entry.link?.href ?? entry.guid;
      return {
        sourceId: source.id,
        sourceType: "rss" as const,
        title: text(entry.title) ?? "Untitled",
        url: String(link ?? ""),
        content: text(entry.description) ?? text(entry.summary) ?? text(entry.content),
        author: text(entry.author?.name) ?? text(entry["dc:creator"]),
        publishedAt: text(entry.pubDate) ?? text(entry.published) ?? text(entry.updated),
        metrics: {},
        raw: entry
      };
    })
    .filter((item) => item.url);
}
