import { getSupabase } from "@/lib/supabase";
import { getAdvisorSuggestion, getCurrentSeason, getTeamId } from "@/lib/queries";

export const dynamic = "force-dynamic";

function PositionBadge({ position }: { position: string }) {
  return (
    <span className="rounded-full bg-[#37003c] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
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
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-extrabold tracking-tight">Transfer Suggestions</h1>
        {suggestion && (
          <span className="text-sm text-gray-400">For gameweek {suggestion.forGameweek}</span>
        )}
      </header>

      {!suggestion ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-gray-400">
          No suggestion generated yet. It runs automatically once a day.
        </div>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-center">
              <div className="text-xl font-extrabold text-[#37003c]">{suggestion.freeTransfers}</div>
              <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Free transfers
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-center">
              <div className="text-xl font-extrabold text-[#37003c]">{suggestion.transfers.length}</div>
              <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Recommended transfers
              </div>
            </div>
          </div>

          <p className="mb-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200">
            {suggestion.summary}
          </p>

          <section className="mb-6">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
              Suggested transfers
            </h2>
            {suggestion.transfers.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-gray-400">
                No transfers recommended this week.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {suggestion.transfers.map((t, i) => (
                  <div key={i} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-slate-900">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <PositionBadge position={t.position} />
                      <span className="font-semibold text-red-600 line-through decoration-2">
                        {t.player_out}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="font-bold text-green-700">{t.player_in}</span>
                      {t.costs_points && (
                        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                          -4 pts
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{t.reasoning}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
              Captaincy
            </h2>
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-slate-900">
              <div className="mb-1.5 flex flex-wrap items-center gap-3 text-sm">
                <span>
                  <span className="font-bold text-[#37003c]">C</span> {suggestion.captain}
                </span>
                <span>
                  <span className="font-bold text-[#37003c]">V</span> {suggestion.viceCaptain}
                </span>
              </div>
              <p className="text-sm text-gray-600">{suggestion.captaincyReasoning}</p>
            </div>
          </section>

          <footer className="mt-6 text-center text-[11px] leading-relaxed text-gray-500">
            Generated {new Date(suggestion.generatedAt).toLocaleString()}.
            <br />
            AI-generated — always sanity-check before using a transfer or a chip.
          </footer>
        </>
      )}
    </main>
  );
}
