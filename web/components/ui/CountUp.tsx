"use client";

import { useEffect, useRef, useState } from "react";
import { compactNumber } from "@/lib/format";

export type NumberStyle = "plain" | "compact" | "rank" | "decimal1";

const L = "en-GB";

function render(n: number, style: NumberStyle, prefix: string, suffix: string): string {
  if (style === "rank") return n > 0 ? `${prefix}${Math.round(n).toLocaleString(L)}${suffix}` : "—";
  if (style === "compact") return `${prefix}${compactNumber(Math.round(n))}${suffix}`;
  if (style === "decimal1")
    return `${prefix}${n.toLocaleString(L, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}${suffix}`;
  return `${prefix}${Math.round(n).toLocaleString(L)}${suffix}`;
}

export function CountUp({
  value,
  duration = 700,
  numberStyle = "plain",
  prefix = "",
  suffix = "",
}: {
  value: number;
  duration?: number;
  numberStyle?: NumberStyle;
  prefix?: string;
  suffix?: string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || fromRef.current === value) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = value;
    };
  }, [value, duration]);

  return <span className="tabular-nums">{render(display, numberStyle, prefix, suffix)}</span>;
}
