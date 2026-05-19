import { and, desc, eq, gte, like, or } from "drizzle-orm";
import type { AppDb } from "../client";
import { aiClassifications, items, sources, summaries, type NewItem } from "../schema";
import { defaultTrend, getTrendSummaries } from "./trends";

type Metrics = Record<string, unknown> | null;

export type HackerNewsReaderItem = {
  id: string;
  title: string;
  displayTitle: string | null;
  url: string;
  author: string | null;
  publishedAt: string | null;
  score: number;
  summary: string | null;
  category: string | null;
  rank: number | null;
  points: number | null;
  commentCount: number;
  feeds: string[];
  reading: {
    translatedTitle: string;
    translatedBody: string;
    keyPoints: string[];
    contextNotes: string[];
    sourceLimitations: string;
    sourceTextAvailable: boolean;
    generatedAt: string | null;
    model: string | null;
  } | null;
  discussion: {
    summary: string;
    keyInsights: string[];
    risks: string[];
    featuredComments: Array<{
      id: number;
      author: string | null;
      text: string;
      reason: string;
      qualityScore: number;
      stance: string;
      url: string;
    }>;
  } | null;
  quality: {
    score: number;
    confidence: number;
    verdict: string;
  } | null;
  commentsUrl: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type GithubTrendingReaderItem = {
  id: string;
  title: string;
  displayTitle: string | null;
  url: string;
  author: string | null;
  publishedAt: string | null;
  score: number;
  summary: string | null;
  category: string | null;
  rank: number | null;
  period: string;
  stars: number;
  forks: number;
  currentPeriodStars: number;
  language: string | null;
  avatar: string | null;
  repository: string;
  brief: {
    chineseName: string;
    overview: string;
    highlights: string[];
    useCases: string[];
    concerns: string[];
    projectStage: string;
    sourceLimitations: string;
    generatedAt: string | null;
    model: string | null;
  } | null;
  quality: {
    score: number;
    confidence: number;
    verdict: string;
  } | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

export async function listItems(
  db: AppDb,
  options: { limit?: number; sourceType?: string; sourceId?: string; q?: string; since?: string; category?: string } = {}
) {
  const filters = [
    options.sourceType ? eq(items.sourceType, options.sourceType) : undefined,
    options.sourceId ? eq(items.sourceId, options.sourceId) : undefined,
    options.since ? gte(items.lastSeenAt, options.since) : undefined,
    options.category ? eq(aiClassifications.category, options.category) : undefined,
    options.q
      ? or(
          like(items.title, `%${options.q}%`),
          like(items.content, `%${options.q}%`),
          like(aiClassifications.displayTitle, `%${options.q}%`),
          like(aiClassifications.summary, `%${options.q}%`)
        )
      : undefined
  ].filter(Boolean);

  const rows = await db
    .select({
      id: items.id,
      sourceId: items.sourceId,
      sourceName: sources.name,
      sourceType: items.sourceType,
      title: items.title,
      displayTitle: aiClassifications.displayTitle,
      url: items.url,
      content: items.content,
      author: items.author,
      publishedAt: items.publishedAt,
      score: items.score,
      metricsJson: items.metricsJson,
      tagsJson: items.tagsJson,
      firstSeenAt: items.firstSeenAt,
      lastSeenAt: items.lastSeenAt,
      summary: summaries.summary,
      reason: summaries.reason,
      aiCategory: aiClassifications.category,
      aiSubCategory: aiClassifications.subCategory,
      aiRelevanceScore: aiClassifications.relevanceScore,
      aiIsNoise: aiClassifications.isNoise,
      aiSummary: aiClassifications.summary,
      aiReason: aiClassifications.reason,
      aiClassifiedAt: aiClassifications.classifiedAt
    })
    .from(items)
    .leftJoin(sources, eq(items.sourceId, sources.id))
    .leftJoin(summaries, eq(items.id, summaries.itemId))
    .leftJoin(aiClassifications, eq(items.id, aiClassifications.itemId))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(items.score), desc(items.lastSeenAt))
    .limit(options.limit ?? 50);

  const itemIds = rows.map((item) => item.id);
  const trendByItemId = itemIds.length ? await getTrendSummaries(db, itemIds) : new Map();
  return rows.map((item) => ({ ...item, trend: trendByItemId.get(item.id) ?? defaultTrend() }));
}

export async function listHackerNewsReaderItems(db: AppDb, options: { limit?: number } = {}): Promise<HackerNewsReaderItem[]> {
  const rows = await db
    .select({
      id: items.id,
      sourceId: items.sourceId,
      title: items.title,
      displayTitle: aiClassifications.displayTitle,
      url: items.url,
      author: items.author,
      publishedAt: items.publishedAt,
      score: items.score,
      metricsJson: items.metricsJson,
      firstSeenAt: items.firstSeenAt,
      lastSeenAt: items.lastSeenAt,
      summary: summaries.summary,
      category: aiClassifications.category
    })
    .from(items)
    .leftJoin(summaries, eq(items.id, summaries.itemId))
    .leftJoin(aiClassifications, eq(items.id, aiClassifications.itemId))
    .where(eq(items.sourceType, "hackernews"))
    .orderBy(desc(items.lastSeenAt), desc(items.score))
    .limit(options.limit ?? 60);

  return rows.map((item) => {
    const metrics = normalizeMetrics(item.metricsJson);
    const breakdown = normalizeMetrics(metrics?.scoreBreakdown);
    const hnDiscussion = normalizeMetrics(metrics?.hnDiscussion);
    const discussion = normalizeDiscussion(normalizeMetrics(metrics?.aiDiscussionDigest));
    return {
      id: item.id,
      title: item.title,
      displayTitle: item.displayTitle,
      url: item.url,
      author: item.author,
      publishedAt: item.publishedAt,
      score: item.score,
      summary: item.summary,
      category: item.category,
      rank: metricNumber(metrics, "rank"),
      points: metricNumber(metrics, "points"),
      commentCount: metricNumber(metrics, "comments") ?? metricNumber(hnDiscussion, "totalReported") ?? 0,
      feeds: normalizeFeeds(metrics, item.sourceId),
      reading: normalizeReading(normalizeMetrics(metrics?.aiReading)),
      discussion,
      quality: normalizeQuality(normalizeMetrics(breakdown?.quality)),
      commentsUrl: typeof hnDiscussion?.commentsUrl === "string" ? hnDiscussion.commentsUrl : null,
      firstSeenAt: item.firstSeenAt,
      lastSeenAt: item.lastSeenAt
    };
  });
}

export async function listGithubTrendingReaderItems(db: AppDb, options: { limit?: number; period?: string } = {}): Promise<GithubTrendingReaderItem[]> {
  const filters = [
    eq(items.sourceType, "github"),
    options.period ? like(items.sourceId, `%${options.period}%`) : undefined
  ].filter(Boolean);

  const rows = await db
    .select({
      id: items.id,
      sourceId: items.sourceId,
      title: items.title,
      displayTitle: aiClassifications.displayTitle,
      url: items.url,
      author: items.author,
      publishedAt: items.publishedAt,
      score: items.score,
      metricsJson: items.metricsJson,
      firstSeenAt: items.firstSeenAt,
      lastSeenAt: items.lastSeenAt,
      summary: summaries.summary,
      category: aiClassifications.category
    })
    .from(items)
    .leftJoin(summaries, eq(items.id, summaries.itemId))
    .leftJoin(aiClassifications, eq(items.id, aiClassifications.itemId))
    .where(and(...filters))
    .orderBy(desc(items.lastSeenAt), desc(items.score))
    .limit(options.limit ?? 60);

  return rows.map((item) => {
    const metrics = normalizeMetrics(item.metricsJson);
    const breakdown = normalizeMetrics(metrics?.scoreBreakdown);
    const brief = normalizeRepoBrief(normalizeMetrics(metrics?.aiRepoBrief));
    const period = stringValue(metrics?.githubTrendingPeriod) ?? (item.sourceId.includes("weekly") ? "weekly" : "daily");
    return {
      id: item.id,
      title: item.title,
      displayTitle: item.displayTitle,
      url: item.url,
      author: item.author,
      publishedAt: item.publishedAt,
      score: item.score,
      summary: item.summary,
      category: item.category,
      rank: metricNumber(metrics, "rank"),
      period,
      stars: metricNumber(metrics, "stars") ?? 0,
      forks: metricNumber(metrics, "forks") ?? 0,
      currentPeriodStars: metricNumber(metrics, "currentPeriodStars") ?? 0,
      language: stringValue(metrics?.language),
      avatar: stringValue(metrics?.avatar),
      repository: stringValue(metrics?.repository) ?? item.title,
      brief,
      quality: normalizeQuality(normalizeMetrics(breakdown?.quality)),
      firstSeenAt: item.firstSeenAt,
      lastSeenAt: item.lastSeenAt
    };
  });
}

export async function upsertItems(db: AppDb, values: NewItem[]) {
  let inserted = 0;
  let updated = 0;

  for (const value of values) {
    const existing = await db.query.items.findFirst({ where: eq(items.url, value.url) });
    if (existing) {
      const metricsJson = mergeItemMetrics(existing.metricsJson, value.metricsJson);
      await db
        .update(items)
        .set({
          score: value.score,
          metricsJson,
          tagsJson: value.tagsJson,
          rawJson: value.rawJson,
          lastSeenAt: value.lastSeenAt,
          content: value.content ?? existing.content,
          publishedAt: value.publishedAt ?? existing.publishedAt
        })
        .where(eq(items.id, existing.id));
      updated += 1;
    } else {
      await db.insert(items).values(value);
      inserted += 1;
    }
  }

  return { inserted, updated };
}

function mergeItemMetrics(existingValue: unknown, nextValue: unknown) {
  const existing = normalizeMetrics(existingValue) ?? {};
  const next = normalizeMetrics(nextValue) ?? {};
  return {
    ...existing,
    ...next,
    hnFeeds: mergeStringArrays(existing.hnFeeds, next.hnFeeds, existing.hnFeed, next.hnFeed)
  };
}

function mergeStringArrays(...values: unknown[]) {
  const merged = new Set<string>();
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string" && entry.trim()) merged.add(entry.trim());
      }
    } else if (typeof value === "string" && value.trim()) {
      merged.add(value.trim());
    }
  }
  return Array.from(merged);
}

function normalizeMetrics(value: unknown): Metrics {
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeReading(value: Metrics): HackerNewsReaderItem["reading"] {
  if (!value) return null;
  const translatedBody = stringValue(value.translatedBody);
  if (!translatedBody) return null;
  return {
    translatedTitle: stringValue(value.translatedTitle) ?? "",
    translatedBody,
    keyPoints: stringArray(value.keyPoints).slice(0, 6),
    contextNotes: stringArray(value.contextNotes).slice(0, 5),
    sourceLimitations: stringValue(value.sourceLimitations) ?? "",
    sourceTextAvailable: Boolean(value.sourceTextAvailable),
    generatedAt: stringValue(value.generatedAt),
    model: stringValue(value.model)
  };
}

function normalizeDiscussion(value: Metrics): HackerNewsReaderItem["discussion"] {
  if (!value) return null;
  return {
    summary: stringValue(value.summary) ?? "",
    keyInsights: stringArray(value.keyInsights).slice(0, 5),
    risks: stringArray(value.risks).slice(0, 4),
    featuredComments: objectArray(value.featuredComments)
      .map(normalizeFeaturedComment)
      .filter((entry): entry is NonNullable<HackerNewsReaderItem["discussion"]>["featuredComments"][number] => entry !== null)
      .slice(0, 5)
  };
}

function normalizeFeaturedComment(value: Record<string, unknown>) {
  const id = metricNumber(value, "id");
  if (id === null) return null;
  return {
    id,
    author: stringValue(value.author),
    text: stringValue(value.text) ?? "",
    reason: stringValue(value.reason) ?? "",
    qualityScore: metricNumber(value, "qualityScore") ?? 0,
    stance: stringValue(value.stance) ?? "",
    url: stringValue(value.url) ?? ""
  };
}

function normalizeQuality(value: Metrics): HackerNewsReaderItem["quality"] {
  if (!value) return null;
  return {
    score: metricNumber(value, "score") ?? 0,
    confidence: metricNumber(value, "confidence") ?? 0,
    verdict: stringValue(value.verdict) ?? "unknown"
  };
}

function normalizeRepoBrief(value: Metrics): GithubTrendingReaderItem["brief"] {
  if (!value) return null;
  const overview = stringValue(value.overview);
  if (!overview) return null;
  return {
    chineseName: stringValue(value.chineseName) ?? "",
    overview,
    highlights: stringArray(value.highlights).slice(0, 6),
    useCases: stringArray(value.useCases).slice(0, 5),
    concerns: stringArray(value.concerns).slice(0, 5),
    projectStage: stringValue(value.projectStage) ?? "",
    sourceLimitations: stringValue(value.sourceLimitations) ?? "",
    generatedAt: stringValue(value.generatedAt),
    model: stringValue(value.model)
  };
}

function normalizeFeeds(metrics: Metrics, sourceId: string) {
  const feeds = stringArray(metrics?.hnFeeds);
  const feed = stringValue(metrics?.hnFeed);
  if (feed) feeds.push(feed);
  if (!feeds.length) {
    if (sourceId.includes("best")) feeds.push("beststories");
    else if (sourceId.includes("top")) feeds.push("topstories");
  }
  return Array.from(new Set(feeds));
}

function metricNumber(metrics: Metrics | Record<string, unknown>, key: string) {
  const value = metrics?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(stringValue).filter((entry): entry is string => entry !== null);
}

function objectArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object");
}
