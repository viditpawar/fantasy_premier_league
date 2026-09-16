import type { ReactNode } from "react";

export function PageHeader({
  icon,
  title,
  subtitle,
  action,
  accent = "var(--accent)",
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
  accent?: string;
}) {
  return (
    <header className="relative mb-5 overflow-hidden rounded-2xl border border-border bg-surface-1 px-4 py-4 shadow-[var(--shadow-card)] sm:px-5 sm:py-5">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{
          background: `radial-gradient(120% 140% at 0% 0%, ${accent}, transparent 60%)`,
        }}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {icon && (
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
              style={{ background: `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 55%, var(--brand-purple)))` }}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold tracking-tight text-fg sm:text-2xl">
              {title}
            </h1>
            {subtitle && <div className="mt-0.5 truncate text-xs text-fg-muted sm:text-sm">{subtitle}</div>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
