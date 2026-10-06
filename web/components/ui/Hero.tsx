import type { ReactNode } from "react";

export interface HeroStat {
  label: string;
  value: ReactNode;
  accent?: boolean;
}

export function Hero({
  eyebrow,
  title,
  subtitle,
  icon,
  stats,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  stats?: HeroStat[];
  action?: ReactNode;
}) {
  return (
    <header className="mesh-hero relative mb-5 px-5 py-6 sm:px-7 sm:py-7">
      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1.5 flex items-center gap-2">
              {icon && (
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-fg backdrop-blur-sm">
                  {icon}
                </span>
              )}
              <span className="section-label text-fg-muted">{eyebrow}</span>
            </div>
          )}
          <h1 className="text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-md text-sm text-fg-muted">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {stats && stats.length > 0 && (
        <div className="relative mt-5 flex flex-wrap gap-x-7 gap-y-3 border-t border-white/10 pt-4">
          {stats.map((s, i) => (
            <div key={i}>
              <div
                className={`text-xl font-extrabold tabular-nums sm:text-2xl ${s.accent ? "text-gradient" : "text-fg"}`}
              >
                {s.value}
              </div>
              <div className="section-label mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
