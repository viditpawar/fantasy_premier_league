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
import { Hero } from "@/components/ui/Hero";
import { SquadView } from "@/components/SquadView";
import { IconBolt, IconPitch } from "@/components/icons";
import { money, rankDelta } from "@/lib/format";

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
      <Hero
        icon={<IconPitch className="h-4 w-4" />}
        eyebrow={`${season} · after GW${gameweek}`}
        title="My Squad"
        stats={[
          { label: "Total points", value: budget.totalPoints, accent: true },
          {
            label: "Overall rank",
            value: budget.overallRank ? `#${budget.overallRank.toLocaleString()}` : "—",
          },
          { label: "Squad value", value: money(budget.teamValue) },
          { label: "In the bank", value: money(budget.bank) },
          ...(rd && rd.direction !== "same"
            ? [
                {
                  label: "Since last GW",
                  value: `${rd.direction === "up" ? "▲" : "▼"} ${rd.value.toLocaleString()}`,
                },
              ]
            : []),
        ]}
      />

      {gwLive && live && (
        <Link
          href="/live"
          className="card-hover mb-4 flex items-center gap-3 rounded-xl border border-accent/40 bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-4 py-3 transition-colors hover:border-accent"
        >
          <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--accent)_18%,transparent)]">
            <IconBolt className="h-5 w-5 text-accent" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--critical)] ring-2 ring-surface-0" />
          </span>
          <div className="flex-1">
            <div className="font-bold text-fg">
              GW{live.gameweek} live · {live.liveTotal} pts
            </div>
            <div className="text-xs text-fg-muted">
              {live.playersPlaying} playing · {live.playersYetToPlay} yet to play · captain{" "}
              {live.captain ?? "—"}
            </div>
          </div>
          <span className="text-sm font-semibold text-accent">Open →</span>
        </Link>
      )}

      <SquadView starting={starting} bench={bench} liveByCode={liveByCode} />

      <footer className="mt-6 text-center text-[11px] leading-relaxed text-fg-subtle">
        Data refreshes with the pipeline ingest (roughly every 2 hours).
        <br />
        Not affiliated with the Premier League or Fantasy Premier League.
      </footer>
    </main>
  );
}
