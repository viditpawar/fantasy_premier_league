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
  accent = "var(--accent)",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  stats?: HeroStat[];
  action?: ReactNode;
  accent?: string;
}) {
  return (
    <header className="glow-hero mb-6 px-5 pt-5 pb-4 sm:px-6 sm:pt-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1.5 flex items-center gap-2">
              {icon && (
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)]"
                  style={{ background: accent }}
                >
                  {icon}
                </span>
              )}
              <span className="section-label">{eyebrow}</span>
            </div>
          )}
          <h1 className="large-title">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-md text-[15px] leading-snug text-fg-muted">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>

      {stats && stats.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-x-7 gap-y-3 border-t border-border pt-4">
          {stats.map((s, i) => (
            <div key={i}>
              <div
                className="text-[22px] font-bold tabular-nums leading-none sm:text-2xl"
                style={{ color: s.accent ? accent : "var(--fg)" }}
              >
                {s.value}
              </div>
              <div className="section-label mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
