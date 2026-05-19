export type AuthState = {
  isAuthenticated: boolean;
  id?: string;
  username?: string;
  avatarUrl?: string | null;
};

export type AccountProfile = {
  id: string;
  username: string;
  avatarUrl: string | null;
};

export const unauthorizedEventName = "template:unauthorized";

export class UnauthorizedError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export async function getCurrentUser(): Promise<AuthState> {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  const payload = await response.json();
  return accountToAuth(Boolean(payload.authenticated), payload.user);
}

export async function login(username: string, password: string): Promise<AuthState> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  if (!response.ok) throw new Error("账号或密码不正确");
  const payload = await response.json();
  return accountToAuth(true, payload.user ?? { username, avatarUrl: null });
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

export async function getAccountProfile(): Promise<AccountProfile> {
  const response = await authorizedFetch("/api/auth/account");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "无法获取账户信息");
  return payload.user;
}

export async function updateAccountProfile(input: {
  username: string;
  avatarUrl: string | null;
}): Promise<AccountProfile> {
  const response = await authorizedFetch("/api/auth/account", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "保存账户信息失败");
  return payload.user;
}

export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  const response = await authorizedFetch("/api/auth/account/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  const payload = await response.json();
  if (!response.ok) {
    if (payload.error === "Current password is incorrect") throw new Error("当前密码不正确");
    throw new Error(payload.error ?? "修改密码失败");
  }
}

async function authorizedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const response = await fetch(input, { ...init, credentials: "include" });
  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent(unauthorizedEventName));
    throw new UnauthorizedError();
  }
  return response;
}

function accountToAuth(isAuthenticated: boolean, account?: Partial<AccountProfile> | null): AuthState {
  if (!isAuthenticated || !account) return { isAuthenticated: false };
  return {
    isAuthenticated: true,
    id: account.id,
    username: account.username,
    avatarUrl: account.avatarUrl ?? null
  };
}
