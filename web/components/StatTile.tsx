import type { ReactNode } from "react";

export function StatTile({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="card group relative overflow-hidden px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-hairline-strong)]">
      <div
        className="absolute inset-x-0 top-0 h-[3px] opacity-80 transition-opacity duration-200 group-hover:opacity-100"
        style={{ background: "linear-gradient(90deg, var(--accent-cyan), var(--accent-green))" }}
      />
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-2xl font-extrabold tracking-tight text-white">{value}</div>
          <div className="mt-1 section-label">{label}</div>
        </div>
        {icon && (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--accent-cyan)]"
            style={{ background: "rgba(5, 240, 255, 0.08)" }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
