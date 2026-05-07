import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";

const sessionCookie = "information_session";
const sessionTtlSeconds = 7 * 24 * 60 * 60;
const sessions = new Map<string, { username: string; expiresAt: number }>();

export const authUsername = process.env.AUTH_USERNAME ?? process.env.ADMIN_USERNAME ?? "admin";
export const authPassword = process.env.AUTH_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "admin123";

export function createSession(c: Context, username: string) {
  const token = crypto.randomUUID();
  sessions.set(token, { username, expiresAt: Date.now() + sessionTtlSeconds * 1000 });
  setCookie(c, sessionCookie, token, {
    httpOnly: true,
    maxAge: sessionTtlSeconds,
    path: "/",
    sameSite: "Lax",
    secure: process.env.NODE_ENV === "production"
  });
}

export function clearSession(c: Context) {
  const token = getCookie(c, sessionCookie);
  if (token) sessions.delete(token);
  deleteCookie(c, sessionCookie, { path: "/" });
}

export function getRequestSession(c: Context) {
  return getValidSession(getCookie(c, sessionCookie));
}

function getValidSession(token?: string) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}
