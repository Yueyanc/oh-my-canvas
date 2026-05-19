import type { CollectedItem, SourceConfig } from "../types";

type HackerNewsFeed = "topstories" | "newstories" | "beststories" | "askstories" | "showstories" | "jobstories";

type HackerNewsItem = {
  id: number;
  deleted?: boolean;
  dead?: boolean;
  type?: "job" | "story" | "comment" | "poll" | "pollopt";
  by?: string;
  time?: number;
  text?: string;
  parent?: number;
  url?: string;
  title?: string;
  score?: number;
  descendants?: number;
  kids?: number[];
};

type HackerNewsComment = {
  id: number;
  author?: string;
  parent?: number;
  text: string;
  depth: number;
  publishedAt?: string;
  replyCount: number;
  url: string;
};

const apiBaseUrl = "https://hacker-news.firebaseio.com/v0";
const defaultFeed: HackerNewsFeed = "topstories";
const defaultLimit = 30;
const defaultComments = {
  maxTopLevel: 8,
  maxDepth: 2,
  maxTotal: 40
};

export async function collectHackerNews(source: SourceConfig): Promise<CollectedItem[]> {
  const feed = parseFeed(source.feed);
  const limit = Math.min(source.limit ?? defaultLimit, maxLimitFor(feed));
  const ids = await fetchJson<number[]>(`${apiBaseUrl}/${feed}.json`);
  const selectedIds = ids.slice(0, limit);
  const items = await Promise.all(
    selectedIds.map(async (id, index) => {
      const item = await fetchJson<HackerNewsItem | null>(`${apiBaseUrl}/item/${id}.json`);
      return item ? toCollectedItem(source, item, index + 1, await collectComments(source, item)) : null;
    })
  );

  return items.filter((item): item is CollectedItem => item !== null);
}

async function collectComments(source: SourceConfig, item: HackerNewsItem) {
  if (!source.comments?.enabled || !item.kids?.length) return undefined;
  const options = {
    maxTopLevel: source.comments.maxTopLevel ?? defaultComments.maxTopLevel,
    maxDepth: source.comments.maxDepth ?? defaultComments.maxDepth,
    maxTotal: source.comments.maxTotal ?? defaultComments.maxTotal
  };
  const comments: HackerNewsComment[] = [];
  for (const id of item.kids.slice(0, options.maxTopLevel)) {
    if (comments.length >= options.maxTotal) break;
    await collectCommentTree(id, 1, options, comments);
  }
  return {
    enabled: true,
    fetchedAt: new Date().toISOString(),
    totalReported: item.descendants ?? 0,
    fetchedCount: comments.length,
    maxDepth: options.maxDepth,
    comments
  };
}

async function collectCommentTree(
  id: number,
  depth: number,
  options: { maxDepth: number; maxTotal: number },
  output: HackerNewsComment[]
) {
  if (depth > options.maxDepth || output.length >= options.maxTotal) return;
  const item = await fetchJson<HackerNewsItem | null>(`${apiBaseUrl}/item/${id}.json`);
  if (!item || item.deleted || item.dead || item.type !== "comment" || !item.text) return;
  output.push({
    id: item.id,
    author: item.by,
    parent: typeof item.parent === "number" ? item.parent : undefined,
    text: cleanHtml(item.text),
    depth,
    publishedAt: item.time ? new Date(item.time * 1000).toISOString() : undefined,
    replyCount: item.kids?.length ?? 0,
    url: `https://news.ycombinator.com/item?id=${item.id}`
  });
  for (const childId of item.kids ?? []) {
    if (output.length >= options.maxTotal) break;
    await collectCommentTree(childId, depth + 1, options, output);
  }
}

function parseFeed(feed: string | undefined): HackerNewsFeed {
  if (
    feed === "topstories" ||
    feed === "newstories" ||
    feed === "beststories" ||
    feed === "askstories" ||
    feed === "showstories" ||
    feed === "jobstories"
  ) {
    return feed;
  }
  return defaultFeed;
}

function maxLimitFor(feed: HackerNewsFeed) {
  if (feed === "askstories" || feed === "showstories" || feed === "jobstories") return 200;
  return 500;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Hacker News fetch failed: ${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

function toCollectedItem(
  source: SourceConfig,
  item: HackerNewsItem,
  rank: number,
  discussion?: {
    enabled: boolean;
    fetchedAt: string;
    totalReported: number;
    fetchedCount: number;
    maxDepth: number;
    comments: HackerNewsComment[];
  }
): CollectedItem | null {
  if (item.deleted || item.dead || !item.title) return null;
  const commentsUrl = `https://news.ycombinator.com/item?id=${item.id}`;
  return {
    sourceId: source.id,
    sourceType: "hackernews" as const,
    title: item.title,
    url: item.url ?? commentsUrl,
    content: item.text,
    author: item.by,
    publishedAt: item.time ? new Date(item.time * 1000).toISOString() : undefined,
    metrics: {
      rank,
      points: item.score,
      comments: item.descendants,
      children: item.kids?.length ?? 0,
      hnFeed: source.feed ?? defaultFeed,
      hnFeeds: [source.feed ?? defaultFeed],
      hnId: item.id,
      hnType: item.type,
      commentsUrl,
      ...(discussion ? { hnDiscussion: discussion } : {})
    },
    raw: item
  };
}

function cleanHtml(value: string) {
  return decodeHtml(
    value
      .replace(/<p>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function decodeHtml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
