import { expect, test } from "bun:test";
import { createDb } from "@template/db";
import {
  changePassword,
  ensureDefaultUser,
  getAccountProfile,
  updateAccountProfile,
  verifyAccountPassword
} from "./accounts";

test("creates the default administrator and verifies the hashed password", async () => {
  const db = createDb("file::memory:");

  const user = await ensureDefaultUser(db, { username: "admin", password: "admin123" });

  expect(user.username).toBe("admin");
  expect(user.passwordHash).not.toBe("admin123");
  expect(await verifyAccountPassword(db, "admin", "admin123")).toEqual({
    id: user.id,
    username: "admin",
    avatarUrl: null
  });
  expect(await verifyAccountPassword(db, "admin", "wrong")).toBeNull();
});

test("updates username and avatar without changing the password", async () => {
  const db = createDb("file::memory:");
  const user = await ensureDefaultUser(db, { username: "admin", password: "admin123" });

  const updated = await updateAccountProfile(db, user.id, {
    username: "updated-admin",
    avatarUrl: "https://example.com/avatar.png"
  });

  expect(updated).toMatchObject({
    id: user.id,
    username: "updated-admin",
    avatarUrl: "https://example.com/avatar.png"
  });
  expect(await verifyAccountPassword(db, "updated-admin", "admin123")).toMatchObject({
    id: user.id,
    username: "updated-admin"
  });
});

test("changes password only when the current password is valid", async () => {
  const db = createDb("file::memory:");
  const user = await ensureDefaultUser(db, { username: "admin", password: "admin123" });

  await expect(changePassword(db, user.id, "wrong", "new-secret")).rejects.toThrow("Current password is incorrect");
  await changePassword(db, user.id, "admin123", "new-secret");

  expect(await verifyAccountPassword(db, "admin", "admin123")).toBeNull();
  expect(await verifyAccountPassword(db, "admin", "new-secret")).toMatchObject({
    id: user.id,
    username: "admin"
  });
  expect(await getAccountProfile(db, user.id)).toMatchObject({ id: user.id, username: "admin" });
});
