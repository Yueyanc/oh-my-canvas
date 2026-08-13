import { createHash, randomBytes } from "node:crypto";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { and, eq, gt, sql } from "drizzle-orm";
import type { AppDb } from "@oh-my-canvas/db/runtime";
import { sessions, users } from "@oh-my-canvas/db/runtime";

const sessionCookie = "oh_my_canvas_session";
const sessionTtlSeconds = 7 * 24 * 60 * 60;

export const authUsername = process.env.AUTH_USERNAME ?? process.env.ADMIN_USERNAME ?? "admin";
export const authPassword = process.env.AUTH_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "admin123";

export type RequestSession = {
  userId: string;
  username: string;
  expiresAt: string;
};

export async function ensureSessionSchema(db: AppDb) {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    )
  `);
  await db.run(sql`CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id)`);
  await db.run(sql`CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at)`);
}

export async function createSession(db: AppDb, c: Context, user: { id: string; username: string }) {
  await ensureSessionSchema(db);
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionTtlSeconds * 1000);

  await db.insert(sessions).values({
    tokenHash: hashSessionToken(token),
    userId: user.id,
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  });

  setCookie(c, sessionCookie, token, {
    httpOnly: true,
    maxAge: sessionTtlSeconds,
    path: "/",
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production"
  });
}

export async function clearSession(db: AppDb, c: Context) {
  await ensureSessionSchema(db);
  const token = getCookie(c, sessionCookie);
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
  deleteCookie(c, sessionCookie, { path: "/" });
}

export async function getRequestSession(db: AppDb, c: Context): Promise<RequestSession | null> {
  await ensureSessionSchema(db);
  const token = getCookie(c, sessionCookie);
  if (!token) return null;

  const now = new Date().toISOString();
  const [session] = await db
    .select({
      userId: sessions.userId,
      username: users.username,
      expiresAt: sessions.expiresAt
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, hashSessionToken(token)), gt(sessions.expiresAt, now)))
    .limit(1);

  if (!session) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token)));
    return null;
  }

  await db
    .update(sessions)
    .set({ lastSeenAt: now })
    .where(eq(sessions.tokenHash, hashSessionToken(token)));

  return session;
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
