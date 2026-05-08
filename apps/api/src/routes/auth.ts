import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppDb } from "@information/db";
import {
  changePassword,
  ensureDefaultUser,
  getAccountProfile,
  updateAccountProfile,
  verifyAccountPassword
} from "../auth/accounts";
import { authPassword, authUsername, clearSession, createSession, getRequestSession } from "../auth/session";

export function createAuthRoutes(db: AppDb) {
  const routes = new Hono();

  routes.post(
    "/login",
    zValidator(
      "json",
      z.object({
        username: z.string().min(1),
        password: z.string().min(1)
      })
    ),
    async (c) => {
      await ensureDefaultUser(db, { username: authUsername, password: authPassword });
      const body = c.req.valid("json");
      const account = await verifyAccountPassword(db, body.username, body.password);
      if (!account) {
        return c.json({ error: "Invalid username or password" }, 401);
      }

      await createSession(db, c, account);
      return c.json({ user: account });
    }
  );

  routes.get("/me", async (c) => {
    const session = await getRequestSession(db, c);
    const account = session ? await getAccountProfile(db, session.userId) : null;
    return c.json({
      authenticated: Boolean(account),
      user: account
    });
  });

  routes.get("/account", async (c) => {
    const session = await getRequestSession(db, c);
    if (!session) return c.json({ error: "Unauthorized" }, 401);
    const account = await getAccountProfile(db, session.userId);
    if (!account) return c.json({ error: "Account not found" }, 404);
    return c.json({ user: account });
  });

  routes.patch(
    "/account",
    zValidator(
      "json",
      z.object({
        username: z.string().trim().min(1).max(64).optional(),
        avatarUrl: z.string().trim().url().nullable().optional()
      })
    ),
    async (c) => {
      const session = await getRequestSession(db, c);
      if (!session) return c.json({ error: "Unauthorized" }, 401);

      const body = c.req.valid("json");
      try {
        const account = await updateAccountProfile(db, session.userId, body);
        await createSession(db, c, account);
        return c.json({ user: account });
      } catch (error) {
        if (error instanceof Error && error.message === "Account not found") {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    }
  );

  routes.post(
    "/account/password",
    zValidator(
      "json",
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8).max(128)
      })
    ),
    async (c) => {
      const session = await getRequestSession(db, c);
      if (!session) return c.json({ error: "Unauthorized" }, 401);

      const body = c.req.valid("json");
      try {
        await changePassword(db, session.userId, body.currentPassword, body.newPassword);
        return c.json({ ok: true });
      } catch (error) {
        if (error instanceof Error && error.message === "Current password is incorrect") {
          return c.json({ error: error.message }, 400);
        }
        if (error instanceof Error && error.message === "Account not found") {
          return c.json({ error: error.message }, 404);
        }
        throw error;
      }
    }
  );

  routes.post("/logout", async (c) => {
    await clearSession(db, c);
    return c.json({ ok: true });
  });

  return routes;
}
