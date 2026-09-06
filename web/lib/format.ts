import type { Position } from "./types";

/** FPL prices/values are stored in tenths of a million. */
export function money(tenths: number | null | undefined): string {
  if (tenths == null) return "—";
  return `£${(tenths / 10).toFixed(1)}m`;
}

/** Fixed locale so server and client render identical strings (no hydration drift). */
export const LOCALE = "en-GB";

export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString(LOCALE);
}

export function compactNumber(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}k`;
  if (Math.abs(n) >= 1_000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString(LOCALE);
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n.toLocaleString(LOCALE) + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export interface RankDelta {
  value: number; // positive = moved up (rank got smaller)
  direction: "up" | "down" | "same";
}

export function rankDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
): RankDelta | null {
  if (current == null || previous == null || previous === 0) return null;
  const value = previous - current;
  return { value: Math.abs(value), direction: value > 0 ? "up" : value < 0 ? "down" : "same" };
}

export function fdrColor(difficulty: number | null | undefined): string {
  switch (difficulty) {
    case 1:
      return "var(--fdr-1)";
    case 2:
      return "var(--fdr-2)";
    case 3:
      return "var(--fdr-3)";
    case 4:
      return "var(--fdr-4)";
    case 5:
      return "var(--fdr-5)";
    default:
      return "var(--fg-subtle)";
  }
}

export function fdrLabel(difficulty: number | null | undefined): string {
  return (
    { 1: "Very easy", 2: "Easy", 3: "Average", 4: "Hard", 5: "Very hard" }[
      difficulty ?? 0
    ] ?? "Unknown"
  );
}

export function positionColor(position: Position): string {
  return (
    { GKP: "var(--warning)", DEF: "var(--cyan)", MID: "var(--accent)", FWD: "var(--critical)" }[
      position
    ] ?? "var(--fg-subtle)"
  );
}

export function kickoffLabel(iso: string | null | undefined): string {
  if (!iso) return "TBC";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "TBC";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export interface Countdown {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  past: boolean;
}

export function countdown(iso: string | null | undefined, now = Date.now()): Countdown | null {
  if (!iso) return null;
  let ms = new Date(iso).getTime() - now;
  const past = ms <= 0;
  ms = Math.abs(ms);
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return { days, hours, minutes, seconds, past };
}

export function countdownLabel(c: Countdown | null): string {
  if (!c) return "—";
  if (c.past) return "Deadline passed";
  if (c.days > 0) return `${c.days}d ${c.hours}h`;
  if (c.hours > 0) return `${c.hours}h ${c.minutes}m`;
  return `${c.minutes}m ${c.seconds}s`;
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}
