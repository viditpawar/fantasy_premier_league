"use client";

import { useState } from "react";

type Theme = "light" | "dark" | "system";

const ORDER: Theme[] = ["system", "light", "dark"];

function readTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem("theme") as Theme | null;
    if (stored && ORDER.includes(stored)) return stored;
  } catch {}
  return "system";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("theme", theme);
  } catch {}
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(next);
    apply(next);
  }

  const icon = theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "🖥️";

  return (
    <button
      onClick={cycle}
      aria-label={`Theme: ${theme}. Click to change.`}
      title={`Theme: ${theme}`}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-sm text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
      suppressHydrationWarning
    >
      {icon}
    </button>
  );
}
