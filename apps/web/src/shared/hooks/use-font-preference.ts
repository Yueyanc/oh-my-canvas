import React from "react";
import { defaultFontKey, fontOptions, type FontKey } from "../config/fonts";

const storageKey = "template-dashboard-font";

export function useFontPreference() {
  const [fontKey, setFontKey] = React.useState<FontKey>(() => {
    if (typeof window === "undefined") return defaultFontKey;
    const stored = window.localStorage.getItem(storageKey);
    return fontOptions.some((option) => option.key === stored) ? (stored as FontKey) : defaultFontKey;
  });

  React.useEffect(() => {
    window.localStorage.setItem(storageKey, fontKey);
  }, [fontKey]);

  const selectedFont = fontOptions.find((option) => option.key === fontKey) ?? fontOptions[0];
  return { fontKey, selectedFont, setFontKey };
}
