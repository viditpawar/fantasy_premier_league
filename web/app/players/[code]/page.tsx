import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import {
  getCurrentSeason,
  getLatestGameweek,
  getPlayerDetail,
  getSquadCodes,
  getTeamId,
} from "@/lib/queries";
import { StatTile } from "@/components/ui/StatTile";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { FDRCell } from "@/components/ui/FDRCell";
import { AreaTrend } from "@/components/charts/AreaTrend";
import { IconArrowLeft } from "@/components/icons";
import { money, compactNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

const PHOTO = (code: number) =>
  `https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`;

const STATUS_LABELS: Record<string, string> = {
  d: "Doubtful",
  i: "Injured",
  s: "Suspended",
  u: "Unavailable",
  n: "Not in squad",
};

export async function generateMetadata(props: PageProps<"/players/[code]">): Promise<Metadata> {
  const { code } = await props.params;
  const sb = getSupabase();
  const season = await getCurrentSeason(sb).catch(() => null);
  if (!season) return { title: "Player" };
  const detail = await getPlayerDetail(sb, season, Number(code)).catch(() => null);
  return { title: detail?.meta.player ?? "Player" };
}

export default async function PlayerDetailPage(props: PageProps<"/players/[code]">) {
  const { code } = await props.params;
  const playerCode = Number(code);
  if (!Number.isFinite(playerCode)) notFound();

  const sb = getSupabase();
  const season = await getCurrentSeason(sb);
  const teamId = await getTeamId(sb).catch(() => null);

  let squadCodes = new Set<number>();
  if (teamId) {
    const gw = await getLatestGameweek(sb, teamId, season).catch(() => null);
    if (gw) squadCodes = await getSquadCodes(sb, teamId, season, gw);
  }

  const detail = await getPlayerDetail(sb, season, playerCode, squadCodes);
  if (!detail) notFound();

  const { meta, gameLog, upcomingFixtures } = detail;

  const cumulativeSeries = gameLog.reduce<{ gameweek: number; points: number }[]>((acc, g) => {
    const points = (acc[acc.length - 1]?.points ?? 0) + g.totalPoints;
    return [...acc, { gameweek: g.gameweek, points }];
  }, []);

  return (
    <main className="animate-fade-in mx-auto w-full max-w-4xl px-4 py-6">
      <Link
        href="/players"
        className="mb-3 inline-flex items-center gap-1 text-sm text-fg-muted transition-colors hover:text-fg"
      >
        <IconArrowLeft className="h-4 w-4" /> Player explorer
      </Link>

      <header className="mb-5 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={PHOTO(meta.playerCode)}
          alt=""
          className="h-20 w-16 rounded-lg bg-surface-2 object-cover object-top"
        />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-fg">{meta.player}</h1>
          <p className="text-sm text-fg-muted">
            {meta.team} · {meta.position} · {money(meta.nowCost)}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {meta.inSquad && <Badge tone="accent">In your squad</Badge>}
            {meta.status !== "a" && (
              <Badge tone="critical">{STATUS_LABELS[meta.status] ?? "Flagged"}</Badge>
            )}
            {meta.ownership != null && (
              <Badge tone="neutral">TSB {compactNumber(meta.ownership)}</Badge>
            )}
          </div>
        </div>
      </header>

      {meta.news && (
        <p className="mb-5 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg-muted">
          {meta.news}
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Total points" value={meta.totalPoints} />
        <StatTile label="Points / game" value={meta.pointsPerGame} numberStyle="decimal1" />
        <StatTile label="Goals" value={meta.goals} />
        <StatTile label="Assists" value={meta.assists} />
        <StatTile label="Clean sheets" value={meta.cleanSheets} />
        <StatTile label="Bonus" value={meta.bonus} />
        <StatTile label="Minutes" value={meta.minutes} />
        <StatTile label="Pts / £m" value={meta.pointsPerMillion} numberStyle="decimal1" />
      </div>

      {upcomingFixtures.length > 0 && (
        <section className="mb-6">
          <SectionHeader title="Next fixtures" />
          <div className="flex flex-wrap gap-1.5">
            {upcomingFixtures.map((f, i) => (
              <FDRCell key={i} opponent={f.opponent} wasHome={f.wasHome} difficulty={f.difficulty} />
            ))}
          </div>
        </section>
      )}

      {cumulativeSeries.length > 1 && (
        <section className="mb-6">
          <SectionHeader title="Cumulative points" />
          <div className="card px-3 py-4">
            <AreaTrend
              data={cumulativeSeries as unknown as Record<string, number>[]}
              dataKey="points"
              label="Total points"
              color="var(--accent)"
            />
          </div>
        </section>
      )}

      <section>
        <SectionHeader title="Gameweek log" />
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse text-center text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wide text-fg-subtle">
                <th className="px-2 py-2 text-left">GW</th>
                <th className="px-2 py-2 text-left">Opp</th>
                <th className="px-2 py-2">Min</th>
                <th className="px-2 py-2">G</th>
                <th className="px-2 py-2">A</th>
                <th className="px-2 py-2">CS</th>
                <th className="px-2 py-2">Bns</th>
                <th className="px-2 py-2">BPS</th>
                <th className="px-2 py-2">ICT</th>
                <th className="px-2 py-2">Pts</th>
              </tr>
            </thead>
            <tbody>
              {gameLog.map((g) => (
                <tr key={g.gameweek} className="border-b border-border/60 last:border-0">
                  <td className="px-2 py-1.5 text-left font-bold text-fg-subtle">{g.gameweek}</td>
                  <td className="px-2 py-1.5 text-left">
                    {g.opponent} {g.wasHome ? "(H)" : "(A)"}
                  </td>
                  <td className="px-2 py-1.5 tabular-nums text-fg-muted">{g.minutes}</td>
                  <td className="px-2 py-1.5 tabular-nums text-fg-muted">{g.goals}</td>
                  <td className="px-2 py-1.5 tabular-nums text-fg-muted">{g.assists}</td>
                  <td className="px-2 py-1.5 tabular-nums text-fg-muted">{g.cleanSheets}</td>
                  <td className="px-2 py-1.5 tabular-nums text-fg-muted">{g.bonus}</td>
                  <td className="px-2 py-1.5 tabular-nums text-fg-muted">{g.bps}</td>
                  <td className="px-2 py-1.5 tabular-nums text-fg-muted">{g.ictIndex.toFixed(1)}</td>
                  <td className="px-2 py-1.5 font-extrabold tabular-nums text-fg">{g.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
