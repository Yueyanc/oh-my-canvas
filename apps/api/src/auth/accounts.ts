import { eq, sql } from "drizzle-orm";
import type { AppDb, User } from "@information/db";
import { users } from "@information/db";

export type PublicAccount = Pick<User, "id" | "username" | "avatarUrl">;

export async function ensureAccountSchema(db: AppDb) {
  await db.run(sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      avatar_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users (username)`);
}

export async function ensureDefaultUser(
  db: AppDb,
  credentials: { username: string; password: string; avatarUrl?: string | null }
) {
  await ensureAccountSchema(db);
  const existing = await db.select().from(users).limit(1);
  if (existing[0]) return existing[0];

  const now = new Date().toISOString();
  const [user] = await db
    .insert(users)
    .values({
      id: crypto.randomUUID(),
      username: credentials.username,
      passwordHash: await hashPassword(credentials.password),
      avatarUrl: credentials.avatarUrl ?? null,
      createdAt: now,
      updatedAt: now
    })
    .returning();
  return user;
}

export async function verifyAccountPassword(db: AppDb, username: string, password: string) {
  await ensureAccountSchema(db);
  const user = await getAccountByUsername(db, username);
  if (!user) return null;
  const isValid = await Bun.password.verify(password, user.passwordHash);
  return isValid ? toPublicAccount(user) : null;
}

export async function getAccountProfile(db: AppDb, userId: string) {
  await ensureAccountSchema(db);
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ? toPublicAccount(user) : null;
}

export async function updateAccountProfile(
  db: AppDb,
  userId: string,
  updates: { username?: string; avatarUrl?: string | null }
) {
  await ensureAccountSchema(db);
  const values: Partial<typeof users.$inferInsert> = { updatedAt: new Date().toISOString() };
  if (updates.username !== undefined) values.username = updates.username;
  if (updates.avatarUrl !== undefined) values.avatarUrl = updates.avatarUrl;

  const [user] = await db.update(users).set(values).where(eq(users.id, userId)).returning();
  if (!user) throw new Error("Account not found");
  return toPublicAccount(user);
}

export async function changePassword(db: AppDb, userId: string, currentPassword: string, nextPassword: string) {
  await ensureAccountSchema(db);
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("Account not found");

  const isValid = await Bun.password.verify(currentPassword, user.passwordHash);
  if (!isValid) throw new Error("Current password is incorrect");

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(nextPassword),
      updatedAt: new Date().toISOString()
    })
    .where(eq(users.id, userId));
}

async function getAccountByUsername(db: AppDb, username: string) {
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return user ?? null;
}

async function hashPassword(password: string) {
  return Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });
}

function toPublicAccount(user: User): PublicAccount {
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl
  };
}
