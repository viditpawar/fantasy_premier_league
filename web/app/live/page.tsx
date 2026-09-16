import type { Metadata } from "next";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import {
  getCurrentSeason,
  getGameweekMeta,
  getLeagueRivals,
  getLiveGameweek,
  getManagerLeagues,
  getTeamId,
} from "@/lib/queries";
import { StatTile } from "@/components/ui/StatTile";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { AutoRefresh } from "@/components/AutoRefresh";
import { IconBolt } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live" };

const SHIRT_URL = (code: number) =>
  `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}-66.png`;

export default async function LivePage() {
  const sb = getSupabase();
  const season = await getCurrentSeason(sb);
  const teamId = await getTeamId(sb);

  const [live, { current }, leagues] = await Promise.all([
    getLiveGameweek(sb, teamId, season),
    getGameweekMeta(sb, season),
    getManagerLeagues(sb, teamId, season),
  ]);

  if (!live) {
    return (
      <main className="animate-fade-in mx-auto w-full max-w-3xl px-4 py-6">
        <PageHeader icon={<IconBolt className="h-5 w-5" />} title="Live gameweek" />
        <EmptyState title="No live gameweek data yet">
          This fills in once the current gameweek&apos;s picks and player scores have been ingested.
        </EmptyState>
      </main>
    );
  }

  const classic =
    leagues.find((l) => l.leagueType === "classic" && /entrada/i.test(l.leagueName)) ??
    leagues.find((l) => l.leagueType === "classic");
  const rivals = classic
    ? await getLeagueRivals(sb, classic.leagueId, season, teamId, classic.leagueName).catch(() => null)
    : null;

  const starting = live.players
    .filter((p) => p.squadPosition <= 11)
    .sort((a, b) => a.squadPosition - b.squadPosition);
  const bench = live.players
    .filter((p) => p.squadPosition > 11)
    .sort((a, b) => a.squadPosition - b.squadPosition);

  const vsAvg =
    live.averageEntryScore != null ? live.liveTotal - live.averageEntryScore : null;

  return (
    <main className="animate-fade-in mx-auto w-full max-w-3xl px-4 py-6">
      <PageHeader
        icon={
          <span className="relative flex h-full w-full items-center justify-center">
            <IconBolt className="h-5 w-5" />
            {!current?.finished && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--critical)] ring-2 ring-surface-1" />
            )}
          </span>
        }
        title={`GW${live.gameweek} live`}
        subtitle={current?.finished ? "Gameweek finished — scores final" : "Updates with the pipeline ingest"}
        action={<AutoRefresh seconds={60} />}
      />

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Live points" value={live.liveTotal} accent="var(--accent)" />
        <StatTile
          label="On the bench"
          value={live.benchPoints}
          accent="var(--warning)"
          hint="Not counting"
        />
        <StatTile label="Yet to play" value={live.playersYetToPlay} hint={`${live.playersPlaying} playing now`} />
        <StatTile
          label="vs average"
          value={vsAvg ?? 0}
          prefix={vsAvg != null && vsAvg > 0 ? "+" : ""}
          accent={vsAvg != null && vsAvg >= 0 ? "var(--good)" : "var(--critical)"}
          hint={live.averageEntryScore != null ? `avg ${live.averageEntryScore}` : undefined}
        />
      </div>

      <section className="mb-6">
        <SectionHeader title="Starting XI" hint={`captain: ${live.captain ?? "—"}`} />
        <div className="card divide-y divide-border overflow-hidden">
          {starting.map((p) => (
            <div key={p.playerCode} className="flex items-center gap-3 px-3 py-2 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SHIRT_URL(p.teamCode)} alt="" className="h-6 w-6 shrink-0 object-contain" />
              <span className="w-9 shrink-0 text-xs font-bold text-fg-subtle">{p.position}</span>
              <span className="flex-1 truncate font-semibold text-fg">
                {p.player}
                {p.isCaptain && <span className="ml-1 text-accent">(C)</span>}
                {p.isViceCaptain && <span className="ml-1 text-fg-subtle">(V)</span>}
              </span>
              <span className="flex w-16 shrink-0 items-center justify-end gap-1.5 text-right text-xs text-fg-subtle">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{
                    background:
                      p.hasFixture && !p.fixtureFinished && p.minutes > 0
                        ? "var(--good)"
                        : p.hasFixture && !p.fixtureFinished
                          ? "var(--warning)"
                          : "var(--fg-subtle)",
                  }}
                />
                {!p.hasFixture
                  ? "no game"
                  : p.fixtureFinished
                    ? "FT"
                    : p.minutes > 0
                      ? `${p.minutes}'`
                      : "—"}
              </span>
              <span className="w-12 shrink-0 text-right font-extrabold tabular-nums text-fg">
                {p.livePoints * (p.multiplier || 1)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <SectionHeader title="Bench" />
        <div className="card divide-y divide-border overflow-hidden">
          {bench.map((p) => (
            <div key={p.playerCode} className="flex items-center gap-3 px-3 py-2 text-sm text-fg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SHIRT_URL(p.teamCode)} alt="" className="h-6 w-6 shrink-0 object-contain opacity-70" />
              <span className="w-9 shrink-0 text-xs font-bold text-fg-subtle">{p.position}</span>
              <span className="flex-1 truncate">{p.player}</span>
              <span className="w-12 shrink-0 text-right font-bold tabular-nums">{p.livePoints}</span>
            </div>
          ))}
        </div>
      </section>

      {rivals && rivals.nearby.length > 0 && (
        <section>
          <SectionHeader
            title={`${rivals.leagueName} — around you`}
            action={
              <Link href={`/leagues/${rivals.leagueId}`} className="text-xs font-semibold text-accent">
                Full table →
              </Link>
            }
          />
          <div className="card divide-y divide-border overflow-hidden">
            {rivals.nearby.map((r) => (
              <div
                key={r.entryTeamId}
                className={`flex items-center gap-3 px-3 py-2 text-sm ${
                  r.isMe ? "bg-[color-mix(in_oklab,var(--accent)_10%,transparent)]" : ""
                }`}
              >
                <span className="w-8 shrink-0 font-extrabold tabular-nums text-fg-subtle">{r.rank}</span>
                <span className="flex-1 truncate">
                  <span className={`font-semibold ${r.isMe ? "text-accent" : "text-fg"}`}>
                    {r.entryName}
                  </span>
                  <span className="ml-1.5 text-xs text-fg-subtle">{r.playerName}</span>
                </span>
                <span className="w-12 shrink-0 text-right text-xs text-fg-subtle">
                  {r.eventTotal != null ? `GW ${r.eventTotal}` : ""}
                </span>
                <span className="w-14 shrink-0 text-right font-extrabold tabular-nums text-fg">
                  {r.total}
                </span>
              </div>
            ))}
          </div>
          {rivals.me && (
            <p className="mt-2 text-center text-[11px] text-fg-subtle">
              {rivals.gapToFirst != null && rivals.gapToFirst > 0 && (
                <>{rivals.gapToFirst} pts behind 1st</>
              )}
              {rivals.gapToNextRank != null && rivals.gapToNextRank > 0 && (
                <> · {rivals.gapToNextRank} pts to the place above</>
              )}
            </p>
          )}
        </section>
      )}

      <p className="mt-6 text-center text-[11px] text-fg-subtle">
        {current?.finished
          ? "This gameweek is finished — scores are final."
          : "Live scores update with the pipeline ingest (about every 2 hours), not in real time."}
      </p>
    </main>
  );
}
