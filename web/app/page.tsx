import { getSupabase } from "@/lib/supabase";
import { getBudget, getCurrentSeason, getLatestGameweek, getSquad, getTeamId } from "@/lib/queries";
import { PlayerCard } from "@/components/PlayerCard";
import { SquadPlayer } from "@/lib/types";

export const dynamic = "force-dynamic";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-center">
      <div className="text-xl font-extrabold text-[#37003c]">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
    </div>
  );
}

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
        <h1 className="text-xl font-extrabold tracking-tight">My FPL Squad</h1>
        <span className="text-sm text-gray-400">
          Season {season} · after gameweek {gameweek}
        </span>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Total points" value={String(budget.totalPoints)} />
        <StatTile label="Overall rank" value={budget.overallRank ? budget.overallRank.toLocaleString() : "-"} />
        <StatTile label="Squad value" value={`£${(budget.teamValue / 10).toFixed(1)}m`} />
        <StatTile label="In the bank" value={`£${(budget.bank / 10).toFixed(1)}m`} />
      </div>

      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-[#0f9b48] to-[#0b7a38] px-3 pb-6 pt-8 shadow-inner">
        {rows.map((row, i) => (
          <div key={i} className="mb-6 flex flex-wrap justify-evenly gap-2 last:mb-1">
            {row.map((p) => (
              <PlayerCard key={p.playerCode} player={p} />
            ))}
          </div>
        ))}
      </div>

      <div className="mb-2.5 mt-5 text-center text-xs font-bold uppercase tracking-widest text-gray-400">
        Substitutes
      </div>
      <div className="flex flex-wrap justify-evenly gap-4 rounded-2xl border border-white/10 bg-white/5 px-3 py-4">
        {bench.map((p, i) => (
          <div key={p.playerCode} className="text-center">
            <div className="mb-1.5 text-[10.5px] font-bold uppercase text-gray-400">
              {i + 1} · {p.position}
            </div>
            <PlayerCard player={p} />
          </div>
        ))}
      </div>

      <footer className="mt-6 text-center text-[11px] leading-relaxed text-gray-500">
        Live data, refreshed on every page load.
        <br />
        Not affiliated with the Premier League or Fantasy Premier League.
      </footer>
    </main>
  );
}
