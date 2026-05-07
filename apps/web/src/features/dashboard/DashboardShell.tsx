import React from "react";
import { DashboardRail } from "./components/DashboardRail";
import { DashboardTopbar } from "./components/DashboardTopbar";
import { ContentPlaceholder } from "./components/ContentPlaceholder";
import type { FontKey } from "../../shared/config/fonts";

export function DashboardShell({
  fontFamily,
  fontKey,
  username,
  onFontChange,
  onLogout
}: {
  fontFamily: string;
  fontKey: FontKey;
  username?: string;
  onFontChange: (fontKey: FontKey) => void;
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
        <DashboardRail isExpanded={isSidebarExpanded} />

        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DashboardTopbar
            fontKey={fontKey}
            isSidebarExpanded={isSidebarExpanded}
            username={username}
            onFontChange={onFontChange}
            onLogout={onLogout}
            onSidebarToggle={() => setIsSidebarExpanded((current) => !current)}
          />

          <div className="flex min-h-0 min-w-0 flex-1 overflow-y-auto pb-5 pl-2 pr-4 pt-3 sm:pl-3 sm:pr-6 lg:pl-4 lg:pr-8">
            <ContentPlaceholder />
          </div>
        </section>
      </div>
    </main>
  );
}
