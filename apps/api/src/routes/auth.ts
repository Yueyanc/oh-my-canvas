import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { authPassword, authUsername, clearSession, createSession, getRequestSession } from "../auth/session";

export function createAuthRoutes() {
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
      const body = c.req.valid("json");
      if (body.username !== authUsername || body.password !== authPassword) {
        return c.json({ error: "Invalid username or password" }, 401);
      }

      createSession(c, authUsername);
      return c.json({ user: { username: authUsername } });
    }
  );

  routes.get("/me", (c) => {
    const session = getRequestSession(c);
    return c.json({
      authenticated: Boolean(session),
      user: session ? { username: session.username } : null
    });
  });

  routes.post("/logout", (c) => {
    clearSession(c);
    return c.json({ ok: true });
  });

  return routes;
}
