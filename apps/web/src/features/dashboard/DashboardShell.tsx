import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DashboardRail } from "./components/DashboardRail";
import { DashboardTopbar } from "./components/DashboardTopbar";
import { OverviewPage } from "./components/OverviewPage";
import { appRoutes, defaultRoute, type AppRoute } from "../../app/routes";
import type { FontKey } from "../../shared/config/fonts";
import type { ThemeMode, ThemeScheme } from "../../shared/hooks/use-theme-mode";

export function DashboardShell({
  fontFamily,
  fontKey,
  themeMode,
  themeScheme,
  avatarUrl,
  username,
  route,
  onAccountUpdate,
  onFontChange,
  onThemeModeChange,
  onThemeSchemeChange,
  onRouteChange,
  onRouteReset,
  onPasswordChange,
  onLogout
}: {
  fontFamily: string;
  fontKey: FontKey;
  themeMode: ThemeMode;
  themeScheme: ThemeScheme;
  avatarUrl?: string | null;
  username?: string;
  route: AppRoute;
  onAccountUpdate: (input: { username: string; avatarUrl: string | null }) => Promise<void>;
  onFontChange: (fontKey: FontKey) => void;
  onThemeModeChange: (mode: ThemeMode) => void;
  onThemeSchemeChange: (scheme: ThemeScheme) => void;
  onRouteChange: (route: AppRoute) => void;
  onRouteReset: () => void;
  onPasswordChange: (input: { currentPassword: string; newPassword: string }) => Promise<void>;
  onLogout: () => void;
}) {
  const [isSidebarExpanded, setIsSidebarExpanded] = React.useState(false);

  return (
    <main className="h-dvh overflow-hidden bg-radar-canvas text-radar-ink" style={{ fontFamily }}>
      <div
        className={
          isSidebarExpanded
            ? "grid h-full w-full grid-cols-[232px_minmax(0,1fr)] overflow-hidden bg-radar-canvas transition-[grid-template-columns] duration-300 ease-out"
            : "grid h-full w-full grid-cols-[72px_minmax(0,1fr)] overflow-hidden bg-radar-canvas transition-[grid-template-columns] duration-300 ease-out"
        }
      >
        <DashboardRail activeRoute={route} isExpanded={isSidebarExpanded} onRouteChange={onRouteChange} />

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DashboardTopbar
            fontKey={fontKey}
            themeMode={themeMode}
            themeScheme={themeScheme}
            avatarUrl={avatarUrl}
            isSidebarExpanded={isSidebarExpanded}
            username={username}
            onAccountUpdate={onAccountUpdate}
            onFontChange={onFontChange}
            onThemeModeChange={onThemeModeChange}
            onThemeSchemeChange={onThemeSchemeChange}
            onPasswordChange={onPasswordChange}
            onLogout={onLogout}
            onSidebarToggle={() => setIsSidebarExpanded((current) => !current)}
          />

          <div className="flex min-h-0 min-w-0 flex-1 overflow-y-auto pb-5 pl-2 pr-4 pt-3 sm:pl-3 sm:pr-6 lg:pl-4 lg:pr-8">
            <DashboardRoutes onRouteReset={onRouteReset} />
          </div>
        </section>
      </div>
    </main>
  );
}

function DashboardRoutes({ onRouteReset }: { onRouteReset: () => void }) {
  return (
    <Routes>
      <Route element={<Navigate replace to={defaultRoute.path} />} path="/" />
      <Route element={<OverviewPage />} path="/overview" />
      {appRoutes.filter((item) => item.key !== "overview").map((item) => (
        <Route element={<RoutePlaceholder onRouteReset={onRouteReset} route={item} />} key={item.key} path={item.path} />
      ))}
      <Route element={<Navigate replace to={defaultRoute.path} />} path="*" />
    </Routes>
  );
}

function RoutePlaceholder({ route, onRouteReset }: { route: AppRoute; onRouteReset: () => void }) {
  return (
    <section className="flex min-h-[32rem] w-full items-center justify-center rounded-panel border border-dashed border-radar-line bg-radar-surface/70 px-4 text-center">
      <div>
        <p className="text-sm font-medium text-radar-ink">{route.label}模块准备中</p>
        <p className="mt-1 text-xs text-radar-ink-muted">这是模板占位页，你可以在这里接入自己的业务模块。</p>
        <button
          className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onRouteReset}
          type="button"
        >
          返回总览
        </button>
      </div>
    </section>
  );
}
