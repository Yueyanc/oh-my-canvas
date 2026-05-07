export type AuthState = {
  isAuthenticated: boolean;
  username?: string;
};

export async function getCurrentUser(): Promise<AuthState> {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  const payload = await response.json();
  return {
    isAuthenticated: Boolean(payload.authenticated),
    username: payload.user?.username
  };
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
  return { isAuthenticated: true, username: payload.user?.username ?? username };
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}
