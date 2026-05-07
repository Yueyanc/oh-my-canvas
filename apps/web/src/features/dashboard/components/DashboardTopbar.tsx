import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  BellDotIcon,
  Globe02Icon,
  Logout03Icon,
  Menu01Icon,
  MenuCollapseIcon,
  Message02Icon,
  Search01Icon,
  UserCircleIcon
} from "@hugeicons/core-free-icons";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { fontOptions, type FontKey } from "../../../shared/config/fonts";

export function DashboardTopbar({
  fontKey,
  isSidebarExpanded,
  username,
  onFontChange,
  onLogout,
  onSidebarToggle
}: {
  fontKey: FontKey;
  isSidebarExpanded: boolean;
  username?: string;
  onFontChange: (fontKey: FontKey) => void;
  onLogout: () => void;
  onSidebarToggle: () => void;
}) {
  const [isUserMenuOpen, setIsUserMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setIsUserMenuOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsUserMenuOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <header className="flex items-center justify-between gap-4 py-6 pl-2 pr-4 sm:pl-3 sm:pr-6 lg:pl-4 lg:pr-8">
      <div className="flex min-w-0 items-center">
        <button
          aria-label={isSidebarExpanded ? "收起侧边栏" : "展开侧边栏"}
          className="flex h-10 w-10 items-center justify-center rounded-full text-radar-ink-muted transition-colors duration-200 hover:bg-radar-surface hover:text-radar-ink"
          onClick={onSidebarToggle}
          type="button"
        >
          <HugeiconsIcon icon={isSidebarExpanded ? MenuCollapseIcon : Menu01Icon} className="h-5 w-5" />
        </button>
      </div>

      <div className="hidden h-11 w-full max-w-sm items-center gap-2 rounded-full border border-radar-line bg-radar-surface px-4 text-sm text-radar-ink-muted shadow-card lg:flex">
        <HugeiconsIcon icon={Search01Icon} className="h-4 w-4" />
        <span>搜索任意内容</span>
      </div>

      <div className="flex items-center gap-2">
        <Select value={fontKey} onValueChange={(value) => onFontChange(value as FontKey)}>
          <SelectTrigger className="hidden h-10 w-36 rounded-full bg-radar-surface shadow-card sm:flex" aria-label="切换字体">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fontOptions.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          className="hidden h-10 items-center gap-2 rounded-full border border-radar-line bg-radar-surface px-3 text-sm shadow-card sm:flex"
          type="button"
        >
          <HugeiconsIcon icon={Globe02Icon} className="h-4 w-4 text-[#6f6bd9]" />
          中文
        </button>

        <button className="relative hidden h-10 w-10 items-center justify-center rounded-full text-radar-ink-muted sm:flex" type="button">
          <HugeiconsIcon icon={BellDotIcon} className="h-5 w-5" />
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
            9
          </span>
        </button>

        <button className="hidden h-10 w-10 items-center justify-center rounded-full text-radar-ink-muted sm:flex" type="button">
          <HugeiconsIcon icon={Message02Icon} className="h-5 w-5" />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            aria-expanded={isUserMenuOpen}
            aria-label="打开账号菜单"
            aria-haspopup="menu"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card transition-colors duration-200 hover:bg-primary/90"
            onClick={() => setIsUserMenuOpen((current) => !current)}
            type="button"
          >
            <HugeiconsIcon icon={UserCircleIcon} className="h-5 w-5" />
          </button>

          {isUserMenuOpen ? (
            <div
              className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-radar-line bg-radar-surface p-1 text-sm shadow-popover"
              role="menu"
            >
              <div className="px-3 py-2">
                <p className="text-xs text-radar-ink-muted">当前账号</p>
                <p className="mt-0.5 truncate font-medium text-radar-ink">{username ?? "admin"}</p>
              </div>
              <button
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-radar-ink-soft hover:bg-radar-surface-soft hover:text-radar-ink"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onLogout();
                }}
                role="menuitem"
                type="button"
              >
                <HugeiconsIcon icon={Logout03Icon} className="h-4 w-4" />
                退出登录
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
