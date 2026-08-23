import { getSupabase } from "@/lib/supabase";
import { getBudget, getCurrentSeason, getLatestGameweek, getSquad, getTeamId } from "@/lib/queries";
import { PlayerCard } from "@/components/PlayerCard";
import { StatTile } from "@/components/StatTile";
import { SquadPlayer } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SquadPage() {
  const sb = getSupabase();
  const season = await getCurrentSeason(sb);
  const teamId = await getTeamId(sb);
  const gameweek = await getLatestGameweek(sb, teamId, season);
  const [squad, budget] = await Promise.all([
    getSquad(sb, teamId, season, gameweek),
    getBudget(sb, teamId, season, gameweek),
  ]);

  const starting = squad.filter((p) => p.squadPosition <= 11);
  const bench = squad.filter((p) => p.squadPosition > 11).sort((a, b) => a.squadPosition - b.squadPosition);

  const rows: SquadPlayer[][] = (["GKP", "DEF", "MID", "FWD"] as const)
    .map((pos) => starting.filter((p) => p.position === pos).sort((a, b) => a.squadPosition - b.squadPosition))
    .filter((row) => row.length > 0);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">My FPL Squad</h1>
        <span className="text-sm text-[var(--text-secondary)]">
          Season {season} · after gameweek {gameweek}
        </span>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Total points" value={String(budget.totalPoints)} />
        <StatTile label="Overall rank" value={budget.overallRank ? budget.overallRank.toLocaleString() : "-"} />
        <StatTile label="Squad value" value={`£${(budget.teamValue / 10).toFixed(1)}m`} />
        <StatTile label="In the bank" value={`£${(budget.bank / 10).toFixed(1)}m`} />
      </div>

      <div
        className="relative overflow-hidden rounded-2xl px-3 pb-6 pt-8 shadow-2xl"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, #14a852 0%, #0c8a41 42%, #0a6e35 75%, #085c2c 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, #ffffff 0, #ffffff 2px, transparent 2px, transparent 42px)",
          }}
        />
        <div className="pointer-events-none absolute inset-3 rounded-xl border border-white/15" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />

        <div className="relative">
          {rows.map((row, i) => (
            <div key={i} className="mb-6 flex flex-wrap justify-evenly gap-2 last:mb-1">
              {row.map((p) => (
                <PlayerCard key={p.playerCode} player={p} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-2.5 mt-5 text-center section-label">Substitutes</div>
      <div className="card flex flex-wrap justify-evenly gap-4 px-3 py-4">
        {bench.map((p, i) => (
          <div key={p.playerCode} className="text-center">
            <div className="mb-1.5 text-[10.5px] font-bold uppercase text-[var(--text-muted)]">
              {i + 1} · {p.position}
            </div>
            <PlayerCard player={p} />
          </div>
        ))}
      </div>

      <footer className="mt-6 text-center text-[11px] leading-relaxed text-[var(--text-muted)]">
        Live data, refreshed on every page load.
        <br />
        Not affiliated with the Premier League or Fantasy Premier League.
      </footer>
    </main>
  );
}
