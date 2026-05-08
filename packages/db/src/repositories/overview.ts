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
