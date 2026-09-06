"use client";

import type { ReactNode } from "react";

export function ChartTooltip({
  active,
  label,
  rows,
}: {
  active?: boolean;
  label?: ReactNode;
  rows: { key: string; label: string; value: ReactNode; color?: string }[];
}) {
  if (!active) return null;
  return (
    <div className="glass rounded-lg border border-border-strong px-3 py-2 text-xs shadow-[var(--shadow-pop)]">
      {label != null && <div className="mb-1 font-bold text-fg">{label}</div>}
      <div className="flex flex-col gap-0.5">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-fg-muted">
              {r.color && (
                <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
              )}
              {r.label}
            </span>
            <span className="font-semibold tabular-nums text-fg">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
