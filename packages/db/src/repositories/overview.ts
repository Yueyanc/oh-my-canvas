import { desc, eq } from "drizzle-orm";
import type { AppDb } from "../client";
import { aiClassifications, items, runs, sources, summaries } from "../schema";

type OverviewOptions = {
  perSourceLimit?: number;
  globalLimit?: number;
  poolLimit?: number;
};

type Metrics = Record<string, unknown> | null;
type RawMetrics = Record<string, number | string>;

export type OverviewItem = {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  title: string;
  displayTitle: string | null;
  url: string;
  author: string | null;
  publishedAt: string | null;
  score: number;
  rank: number | null;
  displayRank: number | null;
  hot: number | null;
  engagement: number | null;
  metrics: RawMetrics;
  summary: string | null;
  category: string | null;
  tags: string[];
  quality: {
    score: number;
    confidence: number;
    verdict: string;
    assessmentSource: string;
  } | null;
  discussion: {
    commentCount: number;
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
    signals: {
      controversyScore: number;
      expertDensityScore: number;
      practicalValueScore: number;
    };
  } | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type OverviewSource = {
  id: string;
  type: string;
  name: string;
  enabled: boolean;
  weight: number;
  itemCount: number;
  lastSeenAt: string | null;
  topRank: number | null;
  items: OverviewItem[];
};

export type RadarOverview = {
  generatedAt: string;
  latestRun: {
    id: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    collectedCount: number;
    insertedCount: number;
    updatedCount: number;
    error: string | null;
  } | null;
  totals: {
    sourceCount: number;
    activeSourceCount: number;
    itemCount: number;
  };
  globalItems: OverviewItem[];
  sources: OverviewSource[];
};

export async function getRadarOverview(db: AppDb, options: OverviewOptions = {}): Promise<RadarOverview> {
  const perSourceLimit = options.perSourceLimit ?? 10;
  const globalLimit = options.globalLimit ?? 20;
  const poolLimit = options.poolLimit ?? 500;

  const [sourceRows, itemRows, latestRun] = await Promise.all([
    db.select().from(sources).orderBy(desc(sources.weight), sources.name),
    db
      .select({
        id: items.id,
        sourceId: items.sourceId,
        sourceName: sources.name,
        sourceType: items.sourceType,
        title: items.title,
        displayTitle: aiClassifications.displayTitle,
        url: items.url,
        author: items.author,
        publishedAt: items.publishedAt,
        score: items.score,
        metricsJson: items.metricsJson,
        tagsJson: items.tagsJson,
        firstSeenAt: items.firstSeenAt,
        lastSeenAt: items.lastSeenAt,
        summary: summaries.summary,
        category: aiClassifications.category
      })
      .from(items)
      .leftJoin(sources, eq(items.sourceId, sources.id))
      .leftJoin(summaries, eq(items.id, summaries.itemId))
      .leftJoin(aiClassifications, eq(items.id, aiClassifications.itemId))
      .orderBy(desc(items.lastSeenAt), desc(items.score))
      .limit(poolLimit),
    db.query.runs.findFirst({ orderBy: desc(runs.startedAt) })
  ]);

  const overviewItems = itemRows.map<OverviewItem>((item) => {
    const metrics = normalizeMetrics(item.metricsJson);
    const breakdown = normalizeMetrics(metrics?.scoreBreakdown);
    const quality = normalizeQuality(normalizeMetrics(breakdown?.quality));
    const discussion = normalizeDiscussion(normalizeMetrics(metrics?.aiDiscussionDigest), normalizeMetrics(metrics?.hnDiscussion));
    return {
      id: item.id,
      sourceId: item.sourceId,
      sourceName: item.sourceName ?? item.sourceId,
      sourceType: item.sourceType,
      title: item.title,
      displayTitle: item.displayTitle,
      url: item.url,
      author: item.author,
      publishedAt: item.publishedAt,
      score: item.score,
      rank: metricNumber(metrics, "rank"),
      displayRank: null,
      hot: metricNumber(metrics, "hot"),
      engagement: metricNumber(breakdown, "engagementScore"),
      metrics: pickRawMetrics(metrics),
      summary: item.summary,
      category: item.category,
      tags: Array.isArray(item.tagsJson) ? item.tagsJson : [],
      quality,
      discussion,
      firstSeenAt: item.firstSeenAt,
      lastSeenAt: item.lastSeenAt
    };
  });

  const itemsBySource = new Map<string, OverviewItem[]>();
  for (const item of overviewItems) {
    const list = itemsBySource.get(item.sourceId) ?? [];
    list.push(item);
    itemsBySource.set(item.sourceId, list);
  }

  const overviewSources = sourceRows.map<OverviewSource>((source) => {
    const sourceItems = [...(itemsBySource.get(source.id) ?? [])].sort(compareSourceItems);
    const rankedItems = assignDisplayRanks(sourceItems);
    return {
      id: source.id,
      type: source.type,
      name: source.name,
      enabled: source.enabled,
      weight: source.weight,
      itemCount: sourceItems.length,
      lastSeenAt: rankedItems[0]?.lastSeenAt ?? null,
      topRank: bestRank(rankedItems),
      items: rankedItems.slice(0, perSourceLimit)
    };
  });

  const knownSourceIds = new Set(sourceRows.map((source) => source.id));
  for (const [sourceId, sourceItems] of itemsBySource) {
    if (knownSourceIds.has(sourceId)) continue;
    const sortedItems = [...sourceItems].sort(compareSourceItems);
    const rankedItems = assignDisplayRanks(sortedItems);
    overviewSources.push({
      id: sourceId,
      type: sortedItems[0]?.sourceType ?? "unknown",
      name: sortedItems[0]?.sourceName ?? sourceId,
      enabled: true,
      weight: 1,
      itemCount: rankedItems.length,
      lastSeenAt: rankedItems[0]?.lastSeenAt ?? null,
      topRank: bestRank(rankedItems),
      items: rankedItems.slice(0, perSourceLimit)
    });
  }

  overviewSources.sort(compareSources);

  return {
    generatedAt: new Date().toISOString(),
    latestRun: latestRun
      ? {
          id: latestRun.id,
          status: latestRun.status,
          startedAt: latestRun.startedAt,
          finishedAt: latestRun.finishedAt,
          collectedCount: latestRun.collectedCount,
          insertedCount: latestRun.insertedCount,
          updatedCount: latestRun.updatedCount,
          error: latestRun.error
        }
      : null,
    totals: {
      sourceCount: overviewSources.length,
      activeSourceCount: overviewSources.filter((source) => source.enabled).length,
      itemCount: overviewItems.length
    },
    globalItems: assignDisplayRanks([...overviewItems].sort(compareGlobalItems)).slice(0, globalLimit),
    sources: overviewSources
  };
}

function assignDisplayRanks(items: OverviewItem[]) {
  return items.map((item, index) => ({ ...item, displayRank: index + 1 }));
}

function compareSourceItems(a: OverviewItem, b: OverviewItem) {
  const aRank = a.rank;
  const bRank = b.rank;
  const aHasRank = aRank !== null;
  const bHasRank = bRank !== null;
  if (aHasRank && bHasRank && aRank !== bRank) return aRank - bRank;
  if (aHasRank !== bHasRank) return aHasRank ? -1 : 1;
  return compareHotScoreAndTime(a, b);
}

function compareGlobalItems(a: OverviewItem, b: OverviewItem) {
  if (b.score !== a.score) return b.score - a.score;
  return compareHotScoreAndTime(a, b);
}

function compareHotScoreAndTime(a: OverviewItem, b: OverviewItem) {
  const hotDelta = (b.hot ?? 0) - (a.hot ?? 0);
  if (hotDelta !== 0) return hotDelta;
  const engagementDelta = (b.engagement ?? 0) - (a.engagement ?? 0);
  if (engagementDelta !== 0) return engagementDelta;
  if (b.score !== a.score) return b.score - a.score;
  return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
}

function compareSources(a: OverviewSource, b: OverviewSource) {
  if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
  if (b.itemCount !== a.itemCount) return b.itemCount - a.itemCount;
  if (b.weight !== a.weight) return b.weight - a.weight;
  return a.name.localeCompare(b.name);
}

function bestRank(items: OverviewItem[]) {
  const ranks = items.map((item) => item.rank).filter((rank): rank is number => rank !== null);
  return ranks.length ? Math.min(...ranks) : null;
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

function metricNumber(metrics: Metrics, key: string) {
  const value = metrics?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pickRawMetrics(metrics: Metrics): RawMetrics {
  if (!metrics) return {};
  const result: RawMetrics = {};
  for (const key of ["rank", "hot", "stars", "forks", "points", "comments", "likes", "views"]) {
    const value = metrics[key];
    if (typeof value === "number" && Number.isFinite(value)) result[key] = value;
    if (typeof value === "string" && value.trim()) result[key] = value.trim();
  }
  return result;
}

function normalizeQuality(value: Metrics): OverviewItem["quality"] {
  if (!value) return null;
  const score = metricNumber(value, "score");
  const confidence = metricNumber(value, "confidence");
  return {
    score: score ?? 0,
    confidence: confidence ?? 0,
    verdict: typeof value.verdict === "string" ? value.verdict : "unknown",
    assessmentSource: typeof value.assessmentSource === "string" ? value.assessmentSource : "heuristic"
  };
}

function normalizeDiscussion(digest: Metrics, rawDiscussion: Metrics): OverviewItem["discussion"] {
  if (!digest) return null;
  const featured = Array.isArray(digest.featuredComments) ? digest.featuredComments : [];
  const signals = normalizeMetrics(digest.discussionSignals);
  return {
    commentCount: metricNumber(rawDiscussion, "fetchedCount") ?? metricNumber(rawDiscussion, "totalReported") ?? 0,
    summary: typeof digest.summary === "string" ? digest.summary : "",
    keyInsights: stringArray(digest.keyInsights).slice(0, 5),
    risks: stringArray(digest.risks).slice(0, 4),
    featuredComments: featured
      .map((entry) => normalizeFeaturedComment(normalizeMetrics(entry)))
      .filter((entry): entry is NonNullable<OverviewItem["discussion"]>["featuredComments"][number] => entry !== null)
      .slice(0, 5),
    signals: {
      controversyScore: metricNumber(signals, "controversyScore") ?? 0,
      expertDensityScore: metricNumber(signals, "expertDensityScore") ?? 0,
      practicalValueScore: metricNumber(signals, "practicalValueScore") ?? 0
    }
  };
}

function normalizeFeaturedComment(value: Metrics) {
  if (!value) return null;
  const id = metricNumber(value, "id");
  if (id === null) return null;
  return {
    id,
    author: typeof value.author === "string" ? value.author : null,
    text: typeof value.text === "string" ? value.text : "",
    reason: typeof value.reason === "string" ? value.reason : "",
    qualityScore: metricNumber(value, "qualityScore") ?? 0,
    stance: typeof value.stance === "string" ? value.stance : "",
    url: typeof value.url === "string" ? value.url : ""
  };
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}
