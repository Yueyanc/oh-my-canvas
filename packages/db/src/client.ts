import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { defaultDatabaseUrl, getDatabasePath } from "./database-url";
import * as schema from "./schema";

export { getDatabasePath } from "./database-url";

export function createDb(url = process.env.DATABASE_URL ?? defaultDatabaseUrl) {
  const databasePath = getDatabasePath(url);
  mkdirSync(dirname(resolve(databasePath)), { recursive: true });
  const sqlite = new Database(databasePath);
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  return drizzle(sqlite, { schema });
}

export type AppDb = ReturnType<typeof createDb>;
