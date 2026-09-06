import type { Metadata } from "next";
import { getSupabase } from "@/lib/supabase";
import { getAdvisorSuggestion, getCurrentSeason, getPlayers, getTeamId } from "@/lib/queries";
import { StatTile } from "@/components/ui/StatTile";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { TransferCompare } from "@/components/TransferCompare";
import { IconSwap, IconTrendingUp } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Transfers" };

export default async function TransfersPage() {
  const sb = getSupabase();
  const season = await getCurrentSeason(sb);
  const teamId = await getTeamId(sb);
  const [suggestion, players] = await Promise.all([
    getAdvisorSuggestion(sb, teamId, season),
    getPlayers(sb, season),
  ]);

  const byName = new Map(players.map((p) => [p.player.toLowerCase(), p]));

  return (
    <main className="animate-fade-in mx-auto w-full max-w-3xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-fg">Transfer advisor</h1>
        {suggestion && (
          <span className="text-sm text-fg-muted">for GW{suggestion.forGameweek}</span>
        )}
      </header>

      {!suggestion ? (
        <EmptyState title="No suggestion generated yet">
          Run the advisor and apply its response to populate this page — see the README for the free
          (no API key) workflow.
        </EmptyState>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-2.5">
            <StatTile
              label="Free transfers"
              value={suggestion.freeTransfers}
              icon={<IconTrendingUp className="h-4 w-4" />}
            />
            <StatTile
              label="Ranked ideas"
              value={suggestion.recommendedTransfers.length}
              icon={<IconSwap className="h-4 w-4" />}
            />
          </div>

          <p className="card mb-5 px-4 py-3 text-sm leading-relaxed text-fg-muted">
            {suggestion.summary}
          </p>

          <section className="mb-6">
            <SectionHeader
              title="Free transfer — ranked options"
              hint={`Only #1 fits your free transfer${
                suggestion.freeTransfers === 1 ? "" : "s"
              } — the rest are backups if prices move or a player's status changes.`}
            />
            {suggestion.recommendedTransfers.length === 0 ? (
              <div className="card px-4 py-4 text-sm text-fg-muted">
                No transfer recommended this week — hold your squad.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {suggestion.recommendedTransfers.map((t, i) => (
                  <TransferCompare key={i} transfer={t} rank={i + 1} byName={byName} />
                ))}
              </div>
            )}
          </section>

          <section className="mb-6">
            <SectionHeader title="Worth a -4 hit?" />
            {suggestion.hitTransfers.length === 0 ? (
              <div className="card px-4 py-4 text-sm text-fg-muted">
                No transfer is clearly worth paying 4 points for right now.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {suggestion.hitTransfers.map((t, i) => (
                  <TransferCompare key={i} transfer={t} hit byName={byName} />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionHeader title="Captaincy" />
            <div className="card px-4 py-3.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold"
                    style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
                  >
                    C
                  </span>
                  <span className="font-semibold text-fg">{suggestion.captain}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-3 text-[11px] font-extrabold text-fg">
                    V
                  </span>
                  <span className="text-fg-muted">{suggestion.viceCaptain}</span>
                </span>
              </div>
              <p className="text-sm text-fg-muted">{suggestion.captaincyReasoning}</p>
            </div>
          </section>

          <footer className="mt-6 flex flex-col items-center gap-2 text-center text-[11px] text-fg-subtle">
            <Badge tone="neutral">
              Generated {new Date(suggestion.generatedAt).toLocaleString()}
            </Badge>
            <span>AI-generated — always sanity-check before making a transfer or playing a chip.</span>
            <a
              href="https://fantasy.premierleague.com/transfers"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-accent"
            >
              Open FPL transfers →
            </a>
          </footer>
        </>
      )}
    </main>
  );
}
