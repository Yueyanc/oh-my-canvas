import { inArray, sql } from "drizzle-orm";
import type { AppDb } from "../client";
import { aiClassifications, summaries, type NewAiClassification } from "../schema";

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

export async function getSummaries(db: AppDb, itemIds: string[]) {
  if (itemIds.length === 0) return [];
  return db.select().from(summaries).where(inArray(summaries.itemId, itemIds));
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
