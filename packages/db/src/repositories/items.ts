import { and, desc, eq, gte, like, or } from "drizzle-orm";
import type { AppDb } from "../client";
import { aiClassifications, items, sources, summaries, type NewItem } from "../schema";
import { defaultTrend, getTrendSummaries } from "./trends";

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
