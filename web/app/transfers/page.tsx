import { getSupabase } from "@/lib/supabase";
import { getAdvisorSuggestion, getCurrentSeason, getTeamId } from "@/lib/queries";
import { StatTile } from "@/components/StatTile";
import { IconSwap, IconTrendingUp } from "@/components/icons";

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
              label="Recommended transfers"
              value={String(suggestion.transfers.length)}
              icon={<IconSwap className="h-4 w-4" />}
            />
          </div>

          <p className="card mb-5 px-4 py-3 text-sm leading-relaxed text-[var(--text-secondary)]">
            {suggestion.summary}
          </p>

          <section className="mb-6">
            <h2 className="mb-2 section-label">Suggested transfers</h2>
            {suggestion.transfers.length === 0 ? (
              <div className="card px-4 py-4 text-sm text-[var(--text-secondary)]">
                No transfers recommended this week.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {suggestion.transfers.map((t, i) => (
                  <div
                    key={i}
                    className="card px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--border-hairline-strong)]"
                  >
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <PositionBadge position={t.position} />
                      <span className="font-semibold text-[var(--status-critical)] line-through decoration-2">
                        {t.player_out}
                      </span>
                      <span className="text-[var(--text-muted)]">→</span>
                      <span className="font-bold" style={{ color: "var(--status-good)" }}>
                        {t.player_in}
                      </span>
                      {t.costs_points && (
                        <span
                          className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-900"
                          style={{ background: "var(--status-warning)" }}
                        >
                          -4 pts
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">{t.reasoning}</p>
                  </div>
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
