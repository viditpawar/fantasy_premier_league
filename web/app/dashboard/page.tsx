import { getSupabase } from "@/lib/supabase";
import {
  getBudget,
  getCurrentSeason,
  getGameweekHistory,
  getLatestGameweek,
  getTeamId,
  getTopScorers,
} from "@/lib/queries";
import { StatTile } from "@/components/StatTile";
import { IconPiggyBank, IconTrendingUp, IconTrophy, IconWallet } from "@/components/icons";

export const dynamic = "force-dynamic";

const RANK_STYLE: Record<number, string> = {
  0: "bg-[#f5c542] text-slate-900 ring-2 ring-[#f5c542]/40",
  1: "bg-[#c7cad1] text-slate-900 ring-2 ring-[#c7cad1]/40",
  2: "bg-[#d99358] text-slate-900 ring-2 ring-[#d99358]/40",
};

export default async function DashboardPage() {
  const sb = getSupabase();
  const season = await getCurrentSeason(sb);
  const teamId = await getTeamId(sb);
  const gameweek = await getLatestGameweek(sb, teamId, season);
  const [budget, topScorers, history] = await Promise.all([
    getBudget(sb, teamId, season, gameweek),
    getTopScorers(sb, season, 15),
    getGameweekHistory(sb, teamId, season),
  ]);

  const maxPoints = Math.max(...history.map((h) => h.points), 1);
  const chartHeight = 140;

  const iconClass = "h-4 w-4";

  return (
    <main className="animate-fade-in mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Dashboard</h1>
        <span className="text-sm text-[var(--text-secondary)]">
          Season {season} · after gameweek {gameweek}
        </span>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Total points" value={String(budget.totalPoints)} icon={<IconTrophy className={iconClass} />} />
        <StatTile
          label="Overall rank"
          value={budget.overallRank ? budget.overallRank.toLocaleString() : "-"}
          icon={<IconTrendingUp className={iconClass} />}
        />
        <StatTile label="Squad value" value={`£${(budget.teamValue / 10).toFixed(1)}m`} icon={<IconWallet className={iconClass} />} />
        <StatTile label="In the bank" value={`£${(budget.bank / 10).toFixed(1)}m`} icon={<IconPiggyBank className={iconClass} />} />
      </div>

      <section className="mb-6">
        <h2 className="mb-2 section-label">Points per gameweek</h2>
        <div className="card px-4 pb-3 pt-5">
          <div className="relative" style={{ height: chartHeight }}>
            {[0, 0.5, 1].map((frac) => (
              <div
                key={frac}
                className="absolute inset-x-0 border-t"
                style={{ bottom: `${frac * 100}%`, borderColor: "var(--gridline)" }}
              />
            ))}
            <div className="relative flex h-full items-end justify-between gap-2">
              {history.map((h) => {
                const barHeight = Math.max((h.points / maxPoints) * chartHeight, 4);
                return (
                  <div key={h.gameweek} className="group relative flex flex-1 flex-col items-center">
                    <span className="mb-1 text-[11px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">
                      {h.points}
                    </span>
                    <div
                      className="w-full max-w-6 rounded-t-[4px] transition-[filter] duration-150 group-hover:brightness-110"
                      style={{
                        height: barHeight,
                        background: "linear-gradient(180deg, var(--accent-cyan), var(--accent-green))",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-2 flex justify-between gap-2">
            {history.map((h) => (
              <div key={h.gameweek} className="flex-1 text-center text-[10px] text-[var(--text-muted)]">
                GW{h.gameweek}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 section-label">Top scorers this season</h2>
        <div className="card overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-3 border-b border-[var(--border-hairline)] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[var(--text-muted)]">
            <span>#</span>
            <span>Player</span>
            <span className="text-right">Pts</span>
            <span className="text-right">Goals</span>
            <span className="text-right">Assists</span>
          </div>
          {topScorers.map((p, i) => (
            <div
              key={i}
              className={`grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-x-3 px-4 py-2.5 text-sm transition-colors hover:bg-white/[0.05] ${
                i % 2 === 1 ? "bg-white/[0.02]" : ""
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold ${
                  RANK_STYLE[i] ?? "bg-white/10 text-[var(--text-secondary)]"
                }`}
              >
                {i + 1}
              </span>
              <span className="truncate">
                <span className="font-semibold text-white">{p.player}</span>{" "}
                <span className="text-[var(--text-muted)]">{p.team}</span>
              </span>
              <span className="text-right font-extrabold tabular-nums text-white">{p.points}</span>
              <span className="text-right tabular-nums text-[var(--text-secondary)]">{p.goals}</span>
              <span className="text-right tabular-nums text-[var(--text-secondary)]">{p.assists}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
