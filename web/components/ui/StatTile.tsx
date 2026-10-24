import type { ReactNode } from "react";
import { CountUp, type NumberStyle } from "./CountUp";
import { Sparkline } from "./Sparkline";
import { fmtInt } from "@/lib/format";

export interface StatTileProps {
  label: string;
  value: number | string;
  numberStyle?: NumberStyle;
  prefix?: string;
  suffix?: string;
  icon?: ReactNode;
  delta?: { value: number; direction: "up" | "down" | "same"; label?: string };
  spark?: number[];
  accent?: string;
  hint?: string;
}

const DIR_COLOR = {
  up: "var(--good)",
  down: "var(--critical)",
  same: "var(--fg-subtle)",
} as const;

const DIR_ARROW = { up: "▲", down: "▼", same: "→" } as const;

export function StatTile({
  label,
  value,
  numberStyle = "plain",
  prefix,
  suffix,
  icon,
  delta,
  spark,
  accent = "var(--accent)",
  hint,
}: StatTileProps) {
  return (
    <div className="card relative min-w-0 overflow-hidden px-5 py-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="mb-2 truncate text-[10px] font-medium text-fg-muted">{label}</div>
          <div className="truncate text-[27px] font-medium tracking-[-0.05em]" style={{ color: accent }}>
            {typeof value === "number" ? (
              <CountUp value={value} numberStyle={numberStyle} prefix={prefix} suffix={suffix} />
            ) : (
              value
            )}
          </div>
          {hint && <div className="mt-2 text-[10px] text-fg-muted">{hint}</div>}
        </div>
        {icon && (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: "color-mix(in oklab, var(--accent) 12%, transparent)", color: accent }}
          >
            {icon}
          </div>
        )}
      </div>
      {(delta || (spark && spark.length > 1)) && (
        <div className="mt-2 flex items-end justify-between gap-2">
          {delta ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] font-bold"
              style={{ color: DIR_COLOR[delta.direction] }}
            >
              {DIR_ARROW[delta.direction]} {fmtInt(delta.value)}
              {delta.label && <span className="font-medium text-fg-subtle">{delta.label}</span>}
            </span>
          ) : (
            <span />
          )}
          {spark && spark.length > 1 && <Sparkline data={spark} stroke={accent} />}
        </div>
      )}
    </div>
  );
}
