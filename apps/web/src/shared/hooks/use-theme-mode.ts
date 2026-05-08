import React from "react";

export type ThemeMode = "light" | "dark";
export type ThemeScheme = "radar" | "sage" | "ocean" | "dusk";

export const themeOptions: Array<{
  key: ThemeScheme;
  label: string;
  swatch: string;
}> = [
  { key: "radar", label: "雷达", swatch: "bg-[#f8f5ed]" },
  { key: "sage", label: "鼠尾草", swatch: "bg-[#dfead9]" },
  { key: "ocean", label: "雾蓝", swatch: "bg-[#dce9ef]" },
  { key: "dusk", label: "暮紫", swatch: "bg-[#24202c]" }
];

const schemeStorageKey = "information-dashboard-theme-scheme";
const modeStorageKey = "information-dashboard-theme-mode";
const legacyStorageKey = "information-dashboard-theme";

function isThemeScheme(value: string | null): value is ThemeScheme {
  return themeOptions.some((option) => option.key === value);
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark";
}

function getInitialScheme(): ThemeScheme {
  if (typeof window === "undefined") return "radar";
  const stored = window.localStorage.getItem(schemeStorageKey);
  if (isThemeScheme(stored)) return stored;
  const legacy = window.localStorage.getItem(legacyStorageKey);
  return isThemeScheme(legacy) ? legacy : "radar";
}

function getInitialMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(modeStorageKey);
  if (isThemeMode(stored)) return stored;
  const legacy = window.localStorage.getItem(legacyStorageKey);
  if (legacy === "dark" || legacy === "dusk") return "dark";
  if (legacy === "light" || legacy === "sage" || legacy === "ocean") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(scheme: ThemeScheme, mode: ThemeMode) {
  document.documentElement.dataset.theme = scheme;
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
}

export function useThemeMode() {
  const [themeScheme, setThemeScheme] = React.useState<ThemeScheme>(getInitialScheme);
  const [themeMode, setThemeMode] = React.useState<ThemeMode>(getInitialMode);

  React.useEffect(() => {
    applyTheme(themeScheme, themeMode);
    window.localStorage.setItem(schemeStorageKey, themeScheme);
    window.localStorage.setItem(modeStorageKey, themeMode);
  }, [themeMode, themeScheme]);

  return { themeMode, themeScheme, setThemeMode, setThemeScheme };
}
