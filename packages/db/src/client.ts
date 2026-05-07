import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const defaultDatabaseUrl = "file:data/radar.sqlite";

export function getDatabasePath(url = process.env.DATABASE_URL ?? defaultDatabaseUrl) {
  return url.startsWith("file:") ? url.slice(5) : url;
}

export function createDb(url = process.env.DATABASE_URL ?? defaultDatabaseUrl) {
  const databasePath = getDatabasePath(url);
  mkdirSync(dirname(resolve(databasePath)), { recursive: true });
  const sqlite = new Database(databasePath);
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA foreign_keys = ON;");
  return drizzle(sqlite, { schema });
}

export type AppDb = ReturnType<typeof createDb>;
