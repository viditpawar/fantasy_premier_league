import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import {
  getBudget,
  getCurrentSeason,
  getGameweekMeta,
  getLatestGameweek,
  getLiveGameweek,
  getManagerAnalytics,
  getSquad,
  getTeamId,
} from "@/lib/queries";
import { StatTile } from "@/components/ui/StatTile";
import { SquadView } from "@/components/SquadView";
import { IconBolt, IconPiggyBank, IconTrendingUp, IconTrophy, IconWallet } from "@/components/icons";
import { rankDelta } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SquadPage() {
  const sb = getSupabase();
  const season = await getCurrentSeason(sb);
  const teamId = await getTeamId(sb);
  const gameweek = await getLatestGameweek(sb, teamId, season);

  const [squad, budget, analytics, gwMeta, live] = await Promise.all([
    getSquad(sb, teamId, season, gameweek),
    getBudget(sb, teamId, season, gameweek),
    getManagerAnalytics(sb, teamId, season),
    getGameweekMeta(sb, season),
    getLiveGameweek(sb, teamId, season),
  ]);

  const starting = squad.filter((p) => p.squadPosition <= 11);
  const bench = squad
    .filter((p) => p.squadPosition > 11)
    .sort((a, b) => a.squadPosition - b.squadPosition);

  const last = analytics.rows[analytics.rows.length - 1];
  const prev = analytics.rows[analytics.rows.length - 2];
  const rd = rankDelta(last?.overallRank, prev?.overallRank);

  const gwLive = gwMeta.current && !gwMeta.current.finished;
  const liveByCode =
    gwLive && live ? new Map(live.players.map((p) => [p.playerCode, p.livePoints])) : undefined;

  return (
    <main className="animate-fade-in mx-auto w-full max-w-4xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">My Squad</h1>
        <span className="text-sm text-fg-muted">
          {season} · after GW{gameweek}
        </span>
      </header>

      {gwLive && live && (
        <Link
          href="/live"
          className="mb-4 flex items-center gap-3 rounded-xl border border-accent/40 bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-4 py-3 transition-colors hover:border-accent"
        >
          <IconBolt className="h-5 w-5 text-accent" />
          <div className="flex-1">
            <div className="font-bold text-fg">
              GW{live.gameweek} live · {live.liveTotal} pts
            </div>
            <div className="text-xs text-fg-muted">
              {live.playersYetToPlay} yet to play · captain {live.captain ?? "—"}
            </div>
          </div>
          <span className="text-sm font-semibold text-accent">Open →</span>
        </Link>
      )}

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile
          label="Total points"
          value={budget.totalPoints}
          icon={<IconTrophy className="h-4 w-4" />}
        />
        <StatTile
          label="Overall rank"
          value={budget.overallRank ?? 0}
          numberStyle="compact"
          icon={<IconTrendingUp className="h-4 w-4" />}
          delta={rd ? { value: rd.value, direction: rd.direction } : undefined}
        />
        <StatTile
          label="Squad value"
          value={budget.teamValue / 10}
          numberStyle="decimal1"
          prefix="£"
          suffix="m"
          icon={<IconWallet className="h-4 w-4" />}
        />
        <StatTile
          label="In the bank"
          value={budget.bank / 10}
          numberStyle="decimal1"
          prefix="£"
          suffix="m"
          icon={<IconPiggyBank className="h-4 w-4" />}
        />
      </div>

      <SquadView starting={starting} bench={bench} liveByCode={liveByCode} />

      <footer className="mt-6 text-center text-[11px] leading-relaxed text-fg-subtle">
        Data refreshes with the pipeline ingest (roughly every 2 hours).
        <br />
        Not affiliated with the Premier League or Fantasy Premier League.
      </footer>
    </main>
  );
}
