import { getSupabase } from "@/lib/supabase";
import { getAdvisorSuggestion, getCurrentSeason, getTeamId } from "@/lib/queries";
import { StatTile } from "@/components/StatTile";
import { IconSwap, IconTrendingUp } from "@/components/icons";
import { SuggestedTransfer } from "@/lib/types";

export const dynamic = "force-dynamic";

function PositionBadge({ position }: { position: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
      style={{ background: "linear-gradient(90deg, var(--accent-purple), var(--accent-purple-bright))" }}
    >
      {position}
    </span>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const isTop = rank === 1;
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold"
      style={
        isTop
          ? { background: "var(--accent-green)", color: "#06210f", boxShadow: "0 0 0 3px rgba(0,255,133,0.18)" }
          : { background: "rgba(255,255,255,0.08)", color: "var(--text-secondary)" }
      }
      title={isTop ? "Top pick — make this one" : "Backup option"}
    >
      {rank}
    </span>
  );
}

function TransferCard({
  transfer,
  rank,
  hit,
}: {
  transfer: SuggestedTransfer;
  rank?: number;
  hit?: boolean;
}) {
  return (
    <div
      className="card px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-hairline-strong)]"
      style={rank === 1 ? { boxShadow: "inset 3px 0 0 var(--accent-green), var(--shadow-card)" } : undefined}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        {rank != null && <RankBadge rank={rank} />}
        <PositionBadge position={transfer.position} />
        <span className="font-semibold text-[var(--status-critical)] line-through decoration-2">
          {transfer.player_out}
        </span>
        <span className="text-[var(--text-muted)]">→</span>
        <span className="font-bold" style={{ color: "var(--status-good)" }}>
          {transfer.player_in}
        </span>
        {hit && (
          <span
            className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-900"
            style={{ background: "var(--status-warning)" }}
          >
            -4 pts
          </span>
        )}
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{transfer.reasoning}</p>
    </div>
  );
}

export default async function TransfersPage() {
  const sb = getSupabase();
  const season = await getCurrentSeason(sb);
  const teamId = await getTeamId(sb);
  const suggestion = await getAdvisorSuggestion(sb, teamId, season);

  return (
    <main className="animate-fade-in mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-white">Transfer Suggestions</h1>
        {suggestion && (
          <span className="text-sm text-[var(--text-secondary)]">For gameweek {suggestion.forGameweek}</span>
        )}
      </header>

      {!suggestion ? (
        <div className="card px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
          No suggestion generated yet. Run the advisor and apply its response to
          populate this page — see the README for the free (no API key) workflow.
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-2.5">
            <StatTile label="Free transfers" value={String(suggestion.freeTransfers)} icon={<IconTrendingUp className="h-4 w-4" />} />
            <StatTile
              label="Ranked ideas"
              value={String(suggestion.recommendedTransfers.length)}
              icon={<IconSwap className="h-4 w-4" />}
            />
          </div>

          <p className="card mb-5 px-4 py-3 text-sm leading-relaxed text-[var(--text-secondary)]">
            {suggestion.summary}
          </p>

          <section className="mb-6">
            <h2 className="mb-1 section-label">Free transfer — ranked options</h2>
            <p className="mb-2 text-xs text-[var(--text-muted)]">
              Only #1 fits your free transfer{suggestion.freeTransfers === 1 ? "" : "s"} — the rest are backups in
              case prices move or a player's status changes before the deadline.
            </p>
            {suggestion.recommendedTransfers.length === 0 ? (
              <div className="card px-4 py-4 text-sm text-[var(--text-secondary)]">
                No transfer recommended this week — hold your squad.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {suggestion.recommendedTransfers.map((t, i) => (
                  <TransferCard key={i} transfer={t} rank={i + 1} />
                ))}
              </div>
            )}
          </section>

          <section className="mb-6">
            <h2 className="mb-1 section-label">Worth a -4 hit?</h2>
            {suggestion.hitTransfers.length === 0 ? (
              <div className="card px-4 py-4 text-sm text-[var(--text-secondary)]">
                No transfer is clearly worth paying 4 points for right now.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {suggestion.hitTransfers.map((t, i) => (
                  <TransferCard key={i} transfer={t} hit />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 section-label">Captaincy</h2>
            <div className="card px-4 py-3.5">
              <div className="mb-1.5 flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold text-slate-900"
                    style={{ background: "var(--accent-green)" }}
                  >
                    C
                  </span>
                  {suggestion.captain}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[11px] font-extrabold text-slate-900">
                    V
                  </span>
                  {suggestion.viceCaptain}
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)]">{suggestion.captaincyReasoning}</p>
            </div>
          </section>

          <footer className="mt-6 text-center text-[11px] leading-relaxed text-[var(--text-muted)]">
            Generated {new Date(suggestion.generatedAt).toLocaleString()}.
            <br />
            AI-generated — always sanity-check before using a transfer or a chip.
          </footer>
        </>
      )}
    </main>
  );
}
