import type { Metadata } from "next";
import Link from "next/link";
import { getSupabase } from "@/lib/supabase";
import {
  getCurrentSeason,
  getLatestGameweek,
  getPlayerDetail,
  getSquadCodes,
  getTeamId,
} from "@/lib/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ComparePlayers } from "@/components/ComparePlayers";
import { IconArrowLeft, IconSwap } from "@/components/icons";
import type { PlayerDetail } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compare players" };

export default async function ComparePage(props: PageProps<"/players/compare">) {
  const { codes } = await props.searchParams;
  const codeList = (Array.isArray(codes) ? codes[0] : codes ?? "")
    .split(",")
    .map((c) => Number(c))
    .filter((c) => Number.isFinite(c));

  const sb = getSupabase();
  const season = await getCurrentSeason(sb);
  const teamId = await getTeamId(sb).catch(() => null);

  let squadCodes = new Set<number>();
  if (teamId) {
    const gw = await getLatestGameweek(sb, teamId, season).catch(() => null);
    if (gw) squadCodes = await getSquadCodes(sb, teamId, season, gw);
  }

  const details = (
    await Promise.all(codeList.map((code) => getPlayerDetail(sb, season, code, squadCodes)))
  ).filter((d): d is PlayerDetail => d != null);

  return (
    <main className="animate-fade-in mx-auto w-full max-w-4xl px-4 py-6">
      <Link
        href="/players"
        className="mb-3 inline-flex items-center gap-1 text-sm text-fg-muted transition-colors hover:text-fg"
      >
        <IconArrowLeft className="h-4 w-4" /> Player explorer
      </Link>
      <PageHeader
        icon={<IconSwap className="h-5 w-5" />}
        title="Compare players"
        subtitle={`${details.length} player${details.length === 1 ? "" : "s"} · best value highlighted`}
        accent="var(--brand-purple-bright)"
      />

      {details.length < 2 ? (
        <EmptyState title="Pick at least 2 players to compare">
          Head back to the player explorer, tick the checkboxes next to up to 4 players, then hit
          Compare.
        </EmptyState>
      ) : (
        <ComparePlayers details={details} />
      )}
    </main>
  );
}
