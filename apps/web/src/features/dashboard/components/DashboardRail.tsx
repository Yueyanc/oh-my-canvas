import { HugeiconsIcon } from "@hugeicons/react";
import { appRoutes, type AppRoute } from "../../../app/routes";

export function DashboardRail({
  activeRoute,
  isExpanded,
  onRouteChange
}: {
  activeRoute: AppRoute;
  isExpanded: boolean;
  onRouteChange: (route: AppRoute) => void;
}) {
  return (
    <aside
      className="hidden h-full w-full shrink-0 overflow-hidden px-4 py-8 md:flex md:flex-col"
      data-expanded={isExpanded}
    >
      <div
        className={
          isExpanded
            ? "flex h-14 w-14 items-center justify-center text-radar-ink-soft opacity-100 transition-opacity duration-150 ease-out"
            : "pointer-events-none flex h-14 w-14 items-center justify-center text-radar-ink-soft opacity-0 transition-opacity duration-150 ease-out"
        }
      >
        <span className="h-14 w-14 shrink-0" />
      </div>

      <nav className="mt-10 flex flex-1 flex-col gap-3">
        {appRoutes.map((item) => {
          const isActive = activeRoute.key === item.key;
          return (
            <button
              aria-current={isActive ? "page" : undefined}
              className="group flex h-10 w-full items-center text-sm font-medium"
              key={item.key}
              onClick={() => onRouteChange(item)}
              type="button"
            >
              <span
                className={
                  isExpanded
                    ? isActive
                      ? "flex h-10 w-full items-center gap-3 overflow-hidden rounded-full bg-primary text-primary-foreground shadow-sm transition-[width,background-color,color] duration-300 ease-out"
                      : "flex h-10 w-full items-center gap-3 overflow-hidden rounded-full text-radar-ink-muted transition-[width,background-color,color] duration-300 ease-out group-hover:bg-radar-surface group-hover:text-radar-ink"
                    : isActive
                      ? "flex h-10 w-10 items-center gap-0 overflow-hidden rounded-full bg-primary text-primary-foreground shadow-sm transition-[width,background-color,color] duration-300 ease-out"
                      : "flex h-10 w-10 items-center gap-0 overflow-hidden rounded-full text-radar-ink-muted transition-[width,background-color,color] duration-300 ease-out group-hover:bg-radar-surface group-hover:text-radar-ink"
                }
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                  <HugeiconsIcon icon={item.icon} className="h-5 w-5 shrink-0" />
                </span>
                <RailLabel isExpanded={isExpanded}>{item.label}</RailLabel>
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function RailLabel({
  children,
  className = "",
  isExpanded
}: {
  children: string;
  className?: string;
  isExpanded: boolean;
}) {
  return (
    <span
      aria-hidden={!isExpanded}
      className={
        isExpanded
          ? `block max-w-[128px] translate-x-0 overflow-hidden whitespace-nowrap opacity-100 transition-[max-width,opacity,transform] delay-75 duration-200 ease-out ${className}`
          : `block max-w-0 -translate-x-1 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,transform] duration-150 ease-out ${className}`
      }
    >
      {children}
    </span>
  );
}
