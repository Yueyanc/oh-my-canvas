import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ComputerIcon,
  DashboardSquare01Icon,
  Database01Icon,
  ServerStack01Icon
} from "@hugeicons/core-free-icons";
import type { DesktopAppInfo } from "@oh-my-canvas/contracts";

export function OverviewPage() {
  const [appInfo, setAppInfo] = React.useState<DesktopAppInfo | null>(null);

  React.useEffect(() => {
    void window.ohMyCanvas?.getAppInfo().then(setAppInfo);
  }, []);

  const runtime = window.ohMyCanvas ? `Electron ${window.ohMyCanvas.versions.electron}` : "Web preview";
  const statusItems = [
    { icon: ComputerIcon, label: "运行环境", value: runtime },
    { icon: ServerStack01Icon, label: "本地服务", value: "Ready" },
    { icon: Database01Icon, label: "数据存储", value: "SQLite" }
  ];

  return (
    <section className="flex w-full flex-col">
      <header className="border-b border-app-line px-1 pb-8 pt-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase text-app-ink-muted">
          <HugeiconsIcon icon={DashboardSquare01Icon} className="h-4 w-4 text-primary" />
          Desktop workspace
        </div>
        <h1 className="mt-3 text-[1.8rem] font-semibold leading-tight text-app-ink sm:text-3xl">Oh My Canvas</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-app-ink-soft">
          桌面基础框架已就绪，业务工作区将在后续阶段接入。
        </p>
      </header>

      <div className="grid border-b border-app-line md:grid-cols-3">
        {statusItems.map((item) => (
          <div className="flex min-h-28 items-center gap-4 border-app-line px-1 py-5 md:border-r md:px-5 first:md:pl-1 last:md:border-r-0" key={item.label}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-app-surface-soft text-primary">
              <HugeiconsIcon icon={item.icon} className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-app-ink-muted">{item.label}</p>
              <p className="mt-1 truncate text-sm font-semibold text-app-ink">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {appInfo ? (
        <p className="px-1 py-5 text-xs text-app-ink-muted">
          {appInfo.name} v{appInfo.version}
        </p>
      ) : null}
    </section>
  );
}
