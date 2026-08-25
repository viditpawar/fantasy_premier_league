import { getSupabase } from "@/lib/supabase";
import { getBudget, getCurrentSeason, getLatestGameweek, getSquad, getTeamId } from "@/lib/queries";
import { PlayerCard } from "@/components/PlayerCard";
import { StatTile } from "@/components/StatTile";
import { IconPiggyBank, IconTrendingUp, IconTrophy, IconWallet } from "@/components/icons";
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

  const iconClass = "h-4 w-4";

  return (
    <main className="animate-fade-in mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">My FPL Squad</h1>
        <span className="text-sm text-[var(--text-secondary)]">
          Season {season} · after gameweek {gameweek}
        </span>
      </header>

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Total points" value={String(budget.totalPoints)} icon={<IconTrophy className={iconClass} />} />
        <StatTile
          label="Overall rank"
          value={budget.overallRank ? budget.overallRank.toLocaleString() : "-"}
          icon={<IconTrendingUp className={iconClass} />}
        />
        <StatTile label="Squad value" value={`£${(budget.teamValue / 10).toFixed(1)}m`} icon={<IconWallet className={iconClass} />} />
        <StatTile label="In the bank" value={`£${(budget.bank / 10).toFixed(1)}m`} icon={<IconPiggyBank className={iconClass} />} />
      </div>

      <div
        className="relative overflow-hidden rounded-2xl px-3 pb-6 pt-8 shadow-2xl"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, #16b658 0%, #0c8a41 42%, #0a6e35 75%, #085c2c 100%)",
        }}
      >
        {/* mowed-grass stripes */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, #ffffff 0, #ffffff 2px, transparent 2px, transparent 42px)",
          }}
        />
        {/* pitch markings */}
        <div className="pointer-events-none absolute inset-3 rounded-xl border border-white/15" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
        <div className="pointer-events-none absolute left-1/2 top-3 h-px w-[calc(100%-1.5rem)] -translate-x-1/2 bg-white/15" />
        <div className="pointer-events-none absolute left-1/2 top-3 h-14 w-40 -translate-x-1/2 rounded-b-lg border border-t-0 border-white/15" />
        <div className="pointer-events-none absolute bottom-3 left-1/2 h-14 w-40 -translate-x-1/2 rounded-t-lg border border-b-0 border-white/15" />
        {/* vignette for depth */}
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_90px_28px_rgba(0,0,0,0.28)]" />

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
      <div
        className="relative overflow-hidden rounded-2xl border border-white/10 px-3 py-4"
        style={{ background: "linear-gradient(180deg, #14151f, #0a0b12)" }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[3px]"
          style={{ background: "linear-gradient(90deg, var(--accent-purple-bright), var(--accent-cyan))" }}
        />
        <div className="flex flex-wrap justify-evenly gap-4">
          {bench.map((p, i) => (
            <div key={p.playerCode} className="text-center">
              <div className="mb-1.5 text-[10.5px] font-bold uppercase text-[var(--text-muted)]">
                {i + 1} · {p.position}
              </div>
              <PlayerCard player={p} />
            </div>
          ))}
        </div>
      </div>

      <footer className="mt-6 text-center text-[11px] leading-relaxed text-[var(--text-muted)]">
        Live data, refreshed on every page load.
        <br />
        Not affiliated with the Premier League or Fantasy Premier League.
      </footer>
    </main>
  );
}
