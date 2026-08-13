export const defaultDatabaseUrl = "file:data/app.sqlite";

export function getDatabasePath(url = process.env.DATABASE_URL ?? defaultDatabaseUrl) {
  return url.startsWith("file:") ? url.slice(5) : url;
}
