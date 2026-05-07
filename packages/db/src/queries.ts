import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, like, or, sql } from "drizzle-orm";
import type { AppDb } from "./client";
import {
  aiClassifications,
  aiTokenUsage,
  itemObservations,
  items,
  runs,
  sources,
  summaries,
  type NewItem,
  type NewAiClassification,
  type NewAiTokenUsage,
  type NewObservation,
  type NewSource
} from "./schema";

export async function upsertSources(db: AppDb, values: NewSource[]) {
  if (values.length === 0) return;
  await db
    .insert(sources)
    .values(values)
    .onConflictDoUpdate({
      target: sources.id,
      set: {
        type: sql`excluded.type`,
        name: sql`excluded.name`,
        url: sql`excluded.url`,
        query: sql`excluded.query`,
        enabled: sql`excluded.enabled`,
        weight: sql`excluded.weight`,
        updatedAt: sql`excluded.updated_at`
      }
    });
}

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

export async function upsertItems(db: AppDb, values: NewItem[]) {
  let inserted = 0;
  let updated = 0;

  for (const value of values) {
    const existing = await db.query.items.findFirst({ where: eq(items.url, value.url) });
    if (existing) {
      await db
        .update(items)
        .set({
          score: value.score,
          metricsJson: value.metricsJson,
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

export async function insertObservations(db: AppDb, values: NewObservation[]) {
  if (values.length === 0) return;
  await db.insert(itemObservations).values(values);
}

export async function getObservations(
  db: AppDb,
  options: { itemIds?: string[]; since?: string; limit?: number } = {}
) {
  const filters = [
    options.itemIds?.length ? inArray(itemObservations.itemId, options.itemIds) : undefined,
    options.since ? gte(itemObservations.observedAt, options.since) : undefined
  ].filter(Boolean);

  return db
    .select()
    .from(itemObservations)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(itemObservations.observedAt))
    .limit(options.limit ?? 1000);
}

export async function getScoringHistory(db: AppDb, options: { urls?: string[]; since?: string; limit?: number } = {}) {
  const filters = [
    options.urls?.length ? inArray(items.url, options.urls) : undefined,
    options.since ? gte(items.lastSeenAt, options.since) : undefined
  ].filter(Boolean);

  return db
    .select({
      id: items.id,
      sourceId: items.sourceId,
      sourceType: items.sourceType,
      title: items.title,
      url: items.url,
      firstSeenAt: items.firstSeenAt,
      lastSeenAt: items.lastSeenAt,
      metricsJson: items.metricsJson
    })
    .from(items)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(items.lastSeenAt))
    .limit(options.limit ?? 500);
}

export async function upsertSummary(
  db: AppDb,
  value: { itemId: string; summary: string; reason?: string | null; model: string }
) {
  const now = new Date().toISOString();
  await db
    .insert(summaries)
    .values({ ...value, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: summaries.itemId,
      set: {
        summary: value.summary,
        reason: value.reason,
        model: value.model,
        updatedAt: now
      }
    });
}

export async function getAiClassifications(db: AppDb, itemIds: string[]) {
  if (itemIds.length === 0) return [];
  return db.select().from(aiClassifications).where(inArray(aiClassifications.itemId, itemIds));
}

export async function upsertAiClassifications(db: AppDb, values: NewAiClassification[]) {
  if (values.length === 0) return;
  await db
    .insert(aiClassifications)
    .values(values)
    .onConflictDoUpdate({
      target: aiClassifications.itemId,
      set: {
        model: sql`excluded.model`,
        category: sql`excluded.category`,
        subCategory: sql`excluded.sub_category`,
        relevanceScore: sql`excluded.relevance_score`,
        isNoise: sql`excluded.is_noise`,
        displayTitle: sql`excluded.display_title`,
        summary: sql`excluded.summary`,
        reason: sql`excluded.reason`,
        inputHash: sql`excluded.input_hash`,
        classifiedAt: sql`excluded.classified_at`,
        expiresAt: sql`excluded.expires_at`
      }
    });
}

export async function startRun(db: AppDb) {
  const id = randomUUID();
  await db.insert(runs).values({ id, status: "running", startedAt: new Date().toISOString() });
  return id;
}

export async function finishRun(
  db: AppDb,
  id: string,
  result: { status: "success" | "failed"; collectedCount?: number; insertedCount?: number; updatedCount?: number; error?: string }
) {
  await db
    .update(runs)
    .set({
      status: result.status,
      finishedAt: new Date().toISOString(),
      collectedCount: result.collectedCount ?? 0,
      insertedCount: result.insertedCount ?? 0,
      updatedCount: result.updatedCount ?? 0,
      error: result.error
    })
    .where(eq(runs.id, id));
}

export async function listRuns(db: AppDb, limit = 10) {
  return db.select().from(runs).orderBy(desc(runs.startedAt)).limit(limit);
}

export async function getLatestRun(db: AppDb) {
  return db.query.runs.findFirst({ orderBy: desc(runs.startedAt) });
}

export async function insertAiTokenUsage(db: AppDb, values: NewAiTokenUsage[]) {
  if (values.length === 0) return;
  await db.insert(aiTokenUsage).values(values);
}

export async function getAiTokenUsageSummary(db: AppDb) {
  const windows = [
    { key: "5m", label: "5分钟", ms: 5 * 60 * 1000, bucketMs: 60 * 1000 },
    { key: "15m", label: "15分钟", ms: 15 * 60 * 1000, bucketMs: 3 * 60 * 1000 },
    { key: "30m", label: "半小时", ms: 30 * 60 * 1000, bucketMs: 5 * 60 * 1000 },
    { key: "1h", label: "1小时", ms: 60 * 60 * 1000, bucketMs: 10 * 60 * 1000 },
    { key: "5h", label: "5小时", ms: 5 * 60 * 60 * 1000, bucketMs: 30 * 60 * 1000 },
    { key: "12h", label: "12小时", ms: 12 * 60 * 60 * 1000, bucketMs: 60 * 60 * 1000 },
    { key: "1d", label: "1天", ms: 24 * 60 * 60 * 1000, bucketMs: 2 * 60 * 60 * 1000 },
    { key: "7d", label: "7天", ms: 7 * 24 * 60 * 60 * 1000, bucketMs: 12 * 60 * 60 * 1000 }
  ];

  const now = Date.now();
  const maxWindowMs = Math.max(...windows.map((window) => window.ms));
  const earliest = new Date(now - maxWindowMs).toISOString();
  const usageRows = await db
    .select({
      operation: aiTokenUsage.operation,
      promptTokens: aiTokenUsage.promptTokens,
      completionTokens: aiTokenUsage.completionTokens,
      totalTokens: aiTokenUsage.totalTokens,
      createdAt: aiTokenUsage.createdAt
    })
    .from(aiTokenUsage)
    .where(gte(aiTokenUsage.createdAt, earliest));

  const rows = [];
  for (const window of windows) {
    const sinceMs = now - window.ms;
    const since = new Date(sinceMs).toISOString();
    const scopedRows = usageRows.filter((item) => new Date(item.createdAt).getTime() >= sinceMs);
    const bucketCount = Math.ceil(window.ms / window.bucketMs);
    const buckets = Array.from({ length: bucketCount }, (_, index) => {
      const startMs = sinceMs + index * window.bucketMs;
      const endMs = Math.min(startMs + window.bucketMs, now);
      return {
        label: formatUsageBucketLabel(startMs, window.ms),
        start: new Date(startMs).toISOString(),
        end: new Date(endMs).toISOString(),
        classificationTokens: 0,
        summaryTokens: 0,
        totalTokens: 0,
        calls: 0
      };
    });

    const byOperation = new Map<string, { operation: string; calls: number; totalTokens: number }>();
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    for (const item of scopedRows) {
      const createdAtMs = new Date(item.createdAt).getTime();
      if (!Number.isFinite(createdAtMs)) continue;

      const bucketIndex = Math.min(bucketCount - 1, Math.max(0, Math.floor((createdAtMs - sinceMs) / window.bucketMs)));
      const bucket = buckets[bucketIndex];
      if (!bucket) continue;

      const itemTotalTokens = Number(item.totalTokens ?? 0);
      promptTokens += Number(item.promptTokens ?? 0);
      completionTokens += Number(item.completionTokens ?? 0);
      totalTokens += itemTotalTokens;

      bucket.totalTokens += itemTotalTokens;
      bucket.calls += 1;
      if (item.operation === "summary") bucket.summaryTokens += itemTotalTokens;
      else bucket.classificationTokens += itemTotalTokens;

      const operationSummary = byOperation.get(item.operation) ?? { operation: item.operation, calls: 0, totalTokens: 0 };
      operationSummary.calls += 1;
      operationSummary.totalTokens += itemTotalTokens;
      byOperation.set(item.operation, operationSummary);
    }

    rows.push({
      key: window.key,
      label: window.label,
      ms: window.ms,
      since,
      calls: scopedRows.length,
      promptTokens,
      completionTokens,
      totalTokens,
      buckets,
      byOperation: Array.from(byOperation.values())
    });
  }

  return rows;
}

function formatUsageBucketLabel(timestamp: number, windowMs: number) {
  const date = new Date(timestamp);
  if (windowMs <= 24 * 60 * 60 * 1000) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
  const day = date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
  const hour = date.toLocaleTimeString("zh-CN", { hour: "2-digit", hour12: false });
  return `${day} ${hour}`;
}

async function getTrendSummaries(db: AppDb, itemIds: string[]) {
  const since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const observations = await getObservations(db, { itemIds, since, limit: itemIds.length * 30 });
  const grouped = new Map<string, typeof observations>();
  for (const observation of observations) {
    const group = grouped.get(observation.itemId) ?? [];
    group.push(observation);
    grouped.set(observation.itemId, group);
  }

  const trends = new Map<string, ReturnType<typeof calculateTrend>>();
  for (const [itemId, group] of grouped) {
    trends.set(itemId, calculateTrend(group));
  }
  return trends;
}

function calculateTrend(observations: Array<typeof itemObservations.$inferSelect>) {
  const sorted = [...observations].sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  if (sorted.length === 0) return defaultTrend();
  const scores = sorted.map((item) => item.score);
  const latest = sorted.at(-1)!;
  const previous = sorted.at(-2);
  const recent = scores.slice(-3);
  const previousWindow = scores.slice(Math.max(0, scores.length - 6), Math.max(0, scores.length - 3));
  const recentAverage = average(recent);
  const previousAverage = previousWindow.length ? average(previousWindow) : previous?.score ?? recentAverage;
  const velocity = round1(recentAverage - previousAverage);
  const peak = sorted.reduce((best, item) => (item.score > best.score ? item : best), sorted[0]!);
  const rankDelta = latest.rank && previous?.rank ? previous.rank - latest.rank : 0;
  const lastSeenMinutes = (Date.now() - new Date(latest.observedAt).getTime()) / 1000 / 60;
  const status = trendStatus({
    observationCount: sorted.length,
    velocity,
    rankDelta,
    lastSeenMinutes
  });

  return {
    status,
    velocity,
    observationCount: sorted.length,
    peakScore: peak.score,
    peakAt: peak.observedAt,
    firstObservedAt: sorted[0]!.observedAt,
    lastObservedAt: latest.observedAt,
    rankDelta,
    latestRank: latest.rank
  };
}

function trendStatus(input: { observationCount: number; velocity: number; rankDelta: number; lastSeenMinutes: number }) {
  if (input.lastSeenMinutes > 180) return "expired";
  if (input.observationCount <= 1) return "new";
  if (input.velocity >= 8 || input.rankDelta >= 3) return "rising";
  if (input.velocity <= -8 || input.rankDelta <= -3) return "cooling";
  return "stable";
}

function defaultTrend() {
  return {
    status: "new",
    velocity: 0,
    observationCount: 0,
    peakScore: 0,
    peakAt: null,
    firstObservedAt: null,
    lastObservedAt: null,
    rankDelta: 0,
    latestRank: null
  };
}

function average(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
