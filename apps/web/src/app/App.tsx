import { HugeiconsIcon } from "@hugeicons/react";
import { Loading03Icon } from "@hugeicons/core-free-icons";
import { LoginPage } from "../features/auth/LoginPage";
import { useAuth } from "../features/auth/use-auth";
import { DashboardShell } from "../features/dashboard/DashboardShell";
import { useFontPreference } from "../shared/hooks/use-font-preference";

export function App() {
  const { auth, login, logout } = useAuth();
  const { fontKey, selectedFont, setFontKey } = useFontPreference();

  if (auth === null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <HugeiconsIcon icon={Loading03Icon} className="h-6 w-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!auth.isAuthenticated) return <LoginPage onLogin={login} />;

  return (
    <DashboardShell
      fontFamily={selectedFont.family}
      fontKey={fontKey}
      username={auth.username}
      onFontChange={setFontKey}
      onLogout={logout}
    />
  );
}
