import type { IconSvgElement } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  DeliveryBox01Icon,
  InboxIcon,
  PackageIcon,
  Settings02Icon,
  Shield01Icon,
  WalletCardsIcon
} from "@hugeicons/core-free-icons";

export type AppRouteKey = "overview" | "collect" | "signals" | "tokens" | "resources" | "settings" | "security";

export type AppRoute = {
  key: AppRouteKey;
  path: string;
  label: string;
  icon: IconSvgElement;
};

export const appRoutes: AppRoute[] = [
  { key: "overview", path: "/overview", label: "总览", icon: DashboardSquare01Icon },
  { key: "collect", path: "/collect", label: "采集", icon: DeliveryBox01Icon },
  { key: "signals", path: "/signals", label: "信号", icon: InboxIcon },
  { key: "tokens", path: "/tokens", label: "令牌", icon: WalletCardsIcon },
  { key: "resources", path: "/resources", label: "资源", icon: PackageIcon },
  { key: "settings", path: "/settings", label: "设置", icon: Settings02Icon },
  { key: "security", path: "/security", label: "安全", icon: Shield01Icon }
];

export const defaultRoute = appRoutes[0];

export function routeFromPath(pathname: string) {
  return appRoutes.find((route) => route.path === pathname) ?? defaultRoute;
}
