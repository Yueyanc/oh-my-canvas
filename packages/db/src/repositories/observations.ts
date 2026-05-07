import { and, desc, gte, inArray } from "drizzle-orm";
import type { AppDb } from "../client";
import { itemObservations, items, type NewObservation } from "../schema";

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
