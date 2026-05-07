import { sql } from "drizzle-orm";
import type { AppDb } from "../client";
import { sources, type NewSource } from "../schema";

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
