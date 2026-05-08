import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  DeliveryBox01Icon,
  InboxIcon,
  PackageIcon,
  Settings02Icon,
  Shield01Icon,
  WalletCardsIcon
} from "@hugeicons/core-free-icons";

const navItems = [
  { icon: DashboardSquare01Icon, label: "总览" },
  { icon: DeliveryBox01Icon, label: "采集" },
  { icon: InboxIcon, label: "信号" },
  { icon: WalletCardsIcon, label: "令牌" },
  { icon: PackageIcon, label: "资源" },
  { icon: Settings02Icon, label: "设置" },
  { icon: Shield01Icon, label: "安全" }
];

export function DashboardRail({ isExpanded }: { isExpanded: boolean }) {
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
        {navItems.map((item, index) => (
          <button
            key={item.label}
            className="group flex h-10 w-full items-center text-sm font-medium"
            type="button"
          >
            <span
              className={
                isExpanded
                  ? index === 0
                    ? "flex h-10 w-full items-center gap-3 overflow-hidden rounded-full bg-primary text-primary-foreground shadow-sm transition-[width,background-color,color] duration-300 ease-out"
                    : "flex h-10 w-full items-center gap-3 overflow-hidden rounded-full text-radar-ink-muted transition-[width,background-color,color] duration-300 ease-out group-hover:bg-radar-surface group-hover:text-radar-ink"
                  : index === 0
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
        ))}
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
