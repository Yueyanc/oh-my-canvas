import { expect, test } from "bun:test";
import { createDb } from "@information/db";
import { createApiApp } from "../app";
import { ensureDefaultUser } from "../auth/accounts";

test("updates the current account profile through authenticated routes", async () => {
  const db = createDb("file::memory:");
  await ensureDefaultUser(db, { username: "admin", password: "admin123" });
  const app = createApiApp(db);

  const loginResponse = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" })
  });
  const cookie = loginResponse.headers.get("set-cookie") ?? "";

  const updateResponse = await app.request("/api/auth/account", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ username: "radar-admin", avatarUrl: "https://example.com/avatar.png" })
  });
  expect(updateResponse.status).toBe(200);
  expect(await updateResponse.json()).toMatchObject({
    user: { username: "radar-admin", avatarUrl: "https://example.com/avatar.png" }
  });

  const meResponse = await app.request("/api/auth/me", { headers: { cookie } });
  expect(await meResponse.json()).toMatchObject({
    authenticated: true,
    user: { username: "radar-admin", avatarUrl: "https://example.com/avatar.png" }
  });
});

test("changes the current account password through authenticated routes", async () => {
  const db = createDb("file::memory:");
  await ensureDefaultUser(db, { username: "admin", password: "admin123" });
  const app = createApiApp(db);

  const loginResponse = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" })
  });
  const cookie = loginResponse.headers.get("set-cookie") ?? "";

  const passwordResponse = await app.request("/api/auth/account/password", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ currentPassword: "admin123", newPassword: "new-secret" })
  });
  expect(passwordResponse.status).toBe(200);

  const oldLogin = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" })
  });
  expect(oldLogin.status).toBe(401);

  const newLogin = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "new-secret" })
  });
  expect(newLogin.status).toBe(200);
});
