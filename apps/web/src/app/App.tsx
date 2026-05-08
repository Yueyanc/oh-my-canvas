import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon } from "@hugeicons/core-free-icons";
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { LoginPage } from "../features/auth/LoginPage";
import { useAuth } from "../features/auth/use-auth";
import { DashboardShell } from "../features/dashboard/DashboardShell";
import { useFontPreference } from "../shared/hooks/use-font-preference";
import { useThemeMode } from "../shared/hooks/use-theme-mode";
import { defaultRoute, routeFromPath } from "./routes";

export function App() {
  const { auth, login, logout, updateAccount, changePassword } = useAuth();
  const { fontKey, selectedFont, setFontKey } = useFontPreference();
  const { themeMode, themeScheme, setThemeMode, setThemeScheme } = useThemeMode();
  const location = useLocation();
  const navigate = useNavigate();
  const route = routeFromPath(location.pathname);

  if (auth === null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <HugeiconsIcon icon={Loading03Icon} className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <Routes>
        <Route element={<LoginRoute onLogin={login} />} path="/login" />
        <Route element={<Navigate replace to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} />} path="*" />
      </Routes>
    );
  }

  if (location.pathname === "/login") return <AuthenticatedRedirect />;

  return (
    <DashboardShell
      fontFamily={selectedFont.family}
      fontKey={fontKey}
      themeMode={themeMode}
      themeScheme={themeScheme}
      avatarUrl={auth.avatarUrl}
      username={auth.username}
      route={route}
      onAccountUpdate={updateAccount}
      onPasswordChange={changePassword}
      onFontChange={setFontKey}
      onThemeModeChange={setThemeMode}
      onThemeSchemeChange={setThemeScheme}
      onRouteChange={(nextRoute) => navigate(nextRoute.path)}
      onRouteReset={() => navigate(defaultRoute.path, { replace: true })}
      onLogout={logout}
    />
  );
}

function LoginRoute({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = safeRedirectPath(searchParams.get("redirect"));

  return (
    <LoginPage
      onLogin={async (username, password) => {
        await onLogin(username, password);
        navigate(redirect, { replace: true });
      }}
    />
  );
}

function AuthenticatedRedirect() {
  const [searchParams] = useSearchParams();
  return <Navigate replace to={safeRedirectPath(searchParams.get("redirect"))} />;
}

function safeRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return defaultRoute.path;
  return value;
}
