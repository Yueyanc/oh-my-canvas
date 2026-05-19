import type { IconSvgElement } from "@hugeicons/react";
import {
  DashboardSquare01Icon,
  Settings02Icon,
  UserCircleIcon
} from "@hugeicons/core-free-icons";

export type AppRouteKey = "overview" | "account" | "settings";

export type AppRoute = {
  key: AppRouteKey;
  path: string;
  label: string;
  icon: IconSvgElement;
};

export const appRoutes: AppRoute[] = [
  { key: "overview", path: "/overview", label: "总览", icon: DashboardSquare01Icon },
  { key: "account", path: "/account", label: "账号", icon: UserCircleIcon },
  { key: "settings", path: "/settings", label: "设置", icon: Settings02Icon }
];

export const defaultRoute = appRoutes[0];

export function routeFromPath(pathname: string) {
  return appRoutes.find((route) => route.path === pathname) ?? defaultRoute;
}
