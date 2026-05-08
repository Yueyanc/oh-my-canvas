import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Moon02Icon, Sun03Icon } from "@hugeicons/core-free-icons";
import type { ThemeMode } from "../../shared/hooks/use-theme-mode";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    ready: Promise<void>;
    finished?: Promise<void>;
  };
};

export async function runThemeTransition({
  origin,
  onThemeChange
}: {
  origin: HTMLElement;
  onThemeChange: () => void;
}) {
  const documentWithTransition = document as ViewTransitionDocument;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!documentWithTransition.startViewTransition || prefersReducedMotion) {
    onThemeChange();
    return;
  }

  const rect = origin.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  document.documentElement.dataset.themeTransition = "expand";

  const transition = documentWithTransition.startViewTransition(() => {
    onThemeChange();
  });

  await transition.ready;

  document.documentElement.animate(
    {
      clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`]
    },
    {
      duration: 520,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      pseudoElement: "::view-transition-new(root)"
    }
  );

  try {
    await transition.finished;
  } finally {
    delete document.documentElement.dataset.themeTransition;
  }
}

export function AnimatedThemeToggler({
  mode,
  onModeChange
}: {
  mode: ThemeMode;
  onModeChange: (mode: ThemeMode) => void;
}) {
  const isDark = mode === "dark";

  async function toggleTheme(event: React.MouseEvent<HTMLButtonElement>) {
    const nextTheme: ThemeMode = isDark ? "light" : "dark";
    await runThemeTransition({
      origin: event.currentTarget,
      onThemeChange: () => onModeChange(nextTheme)
    });
  }

  return (
    <button
      aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
      aria-pressed={isDark}
      className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-radar-ink-muted transition-[background-color,color,transform] duration-200 hover:bg-radar-surface-soft hover:text-radar-ink active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-radar-lime"
      onClick={toggleTheme}
      type="button"
    >
      <HugeiconsIcon
        icon={Sun03Icon}
        className={`absolute h-5 w-5 transition-[opacity,transform] duration-300 ${
          isDark ? "-rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
        }`}
      />
      <HugeiconsIcon
        icon={Moon02Icon}
        className={`absolute h-5 w-5 transition-[opacity,transform] duration-300 ${
          isDark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0"
        }`}
      />
    </button>
  );
}
