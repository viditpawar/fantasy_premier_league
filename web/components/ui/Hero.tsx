import type { ReactNode } from "react";
export interface HeroStat { label: string; value: ReactNode; accent?: boolean; }
const DESCRIPTIONS: Record<string, string> = {
  "Analytics": "Find the patterns. Understand your progress. See where the next points could come from.",
  "Player explorer": "The numbers behind your next great pick. Explore, filter and compare.",
  "Fixture ticker": "A little foresight goes a long way. Find the most promising runs of fixtures.",
  "Leagues & Cups": "A season of friendly rivalries. Keep an eye on the competition.",
  "Transfer advisor": "A considered second opinion on your next move, built around your squad.",
};
export function Hero({ eyebrow, title, subtitle, icon, stats, action, accent = "var(--accent)" }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; stats?: HeroStat[]; action?: ReactNode; accent?: string }) {
  const description = subtitle || (typeof title === "string" ? DESCRIPTIONS[title] : undefined);
  return <header className="hero-header">
    <div className="flex items-start justify-between gap-4"><div className="min-w-0">
      <div className="page-eyebrow flex items-center gap-1.5">{icon && <span className="[&>svg]:h-3 [&>svg]:w-3" aria-hidden="true">{icon}</span>}{eyebrow ?? "Your fantasy workspace"}</div>
      <h1 className="large-title">{title}</h1>{description && <div className="page-description max-w-2xl">{description}</div>}
    </div>{action && <div className="shrink-0 pt-5">{action}</div>}</div>
    {stats && stats.length > 0 && <div className="hero-stats">{stats.map((stat, i) => <div key={i} className="hero-stat"><div className="section-label mb-1.5">{stat.label}</div><div className="hero-stat-value" style={{ color: stat.accent ? accent : "var(--fg)" }}>{stat.value}</div></div>)}</div>}
  </header>;
}
