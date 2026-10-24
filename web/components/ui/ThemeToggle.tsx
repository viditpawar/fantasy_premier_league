"use client";
import { useSyncExternalStore } from "react";
function subscribe(callback: () => void) { window.addEventListener("fpl:theme", callback); window.addEventListener("storage", callback); return () => { window.removeEventListener("fpl:theme", callback); window.removeEventListener("storage", callback); }; }
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => document.documentElement.dataset.theme === "dark" ? "dark" : "light", () => "light");
  function setTheme(next: "light" | "dark") { document.documentElement.dataset.theme = next; try { localStorage.setItem("theme", next); } catch {} window.dispatchEvent(new Event("fpl:theme")); }
  return { theme, setTheme };
}
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return <button className="icon-button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={`Switch to ${theme === "light" ? "dark" : "light"} appearance`} title="Change appearance"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">{theme === "light" ? <><circle cx="12" cy="12" r="3.7" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" /></> : <path d="M20.5 14A8.7 8.7 0 0 1 10 3.5 8.7 8.7 0 1 0 20.5 14Z" />}</svg></button>;
}
