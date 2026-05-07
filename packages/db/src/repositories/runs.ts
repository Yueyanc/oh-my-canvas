import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import type { AppDb } from "../client";
import { runs } from "../schema";

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
