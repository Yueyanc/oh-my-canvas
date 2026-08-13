import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { AppDb } from "./client";
import { defaultDatabaseUrl, getDatabasePath } from "./database-url";
import * as schema from "./schema";

export function createNodeDb(url = process.env.DATABASE_URL ?? defaultDatabaseUrl): AppDb {
  const databasePath = getDatabasePath(url);
  mkdirSync(dirname(resolve(databasePath)), { recursive: true });
  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema }) as unknown as AppDb;
}
