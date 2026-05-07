import React from "react";
import * as api from "../../shared/api/client";

export function useAuth() {
  const [auth, setAuth] = React.useState<api.AuthState | null>(null);

  React.useEffect(() => {
    api.getCurrentUser().then(setAuth).catch(() => setAuth({ isAuthenticated: false }));
  }, []);

  async function login(username: string, password: string) {
    const nextAuth = await api.login(username, password);
    setAuth(nextAuth);
  }

  async function logout() {
    await api.logout();
    setAuth({ isAuthenticated: false });
  }

  return { auth, login, logout };
}
