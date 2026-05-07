import type { CollectedItem, SourceConfig } from "../types";

export async function collectHackerNews(source: SourceConfig): Promise<CollectedItem[]> {
  if (!source.query) throw new Error(`Hacker News source ${source.id} requires query`);
  const url = new URL("https://hn.algolia.com/api/v1/search_by_date");
  url.searchParams.set("query", source.query);
  url.searchParams.set("tags", "story");
  url.searchParams.set("hitsPerPage", "20");

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Hacker News fetch failed for ${source.name}: ${response.status}`);
  const payload = (await response.json()) as { hits?: any[] };

  return (payload.hits ?? [])
    .map((hit) => ({
      sourceId: source.id,
      sourceType: "hackernews" as const,
      title: hit.title ?? hit.story_title ?? "Untitled",
      url: hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`,
      content: hit.story_text,
      author: hit.author,
      publishedAt: hit.created_at,
      metrics: {
        points: hit.points,
        comments: hit.num_comments
      },
      raw: hit
    }))
    .filter((item) => item.url);
}
