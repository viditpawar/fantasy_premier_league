import { getSupabase } from "@/lib/supabase";
import {
  getBudget,
  getCurrentSeason,
  getGameweekHistory,
  getLatestGameweek,
  getTeamId,
  getTopScorers,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-center">
      <div className="text-xl font-extrabold text-[#37003c]">{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const sb = getSupabase();
  const season = await getCurrentSeason(sb);
  const teamId = await getTeamId(sb);
  const gameweek = await getLatestGameweek(sb, teamId, season);
  const [budget, topScorers, history] = await Promise.all([
    getBudget(sb, teamId, season, gameweek),
    getTopScorers(sb, season, 15),
    getGameweekHistory(sb, teamId, season),
  ]);

  const maxPoints = Math.max(...history.map((h) => h.points), 1);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-extrabold tracking-tight">Dashboard</h1>
        <span className="text-sm text-gray-400">
          Season {season} · after gameweek {gameweek}
        </span>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile label="Total points" value={String(budget.totalPoints)} />
        <StatTile label="Overall rank" value={budget.overallRank ? budget.overallRank.toLocaleString() : "-"} />
        <StatTile label="Squad value" value={`£${(budget.teamValue / 10).toFixed(1)}m`} />
        <StatTile label="In the bank" value={`£${(budget.bank / 10).toFixed(1)}m`} />
      </div>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
          Points per gameweek
        </h2>
        <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-white/5 p-4">
          {history.map((h) => (
            <div key={h.gameweek} className="flex flex-1 flex-col items-center gap-1">
              <div className="text-xs font-semibold text-gray-300">{h.points}</div>
              <div
                className="w-full rounded-t bg-cyan-400"
                style={{ height: `${Math.max((h.points / maxPoints) * 100, 4)}px` }}
              />
              <div className="text-[10px] text-gray-500">GW{h.gameweek}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">
          Top scorers this season
        </h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white text-slate-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2 text-right">Pts</th>
                <th className="px-3 py-2 text-right">Goals</th>
                <th className="px-3 py-2 text-right">Assists</th>
              </tr>
            </thead>
            <tbody>
              {topScorers.map((p, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 font-semibold">{p.player}</td>
                  <td className="px-3 py-2 text-gray-500">{p.team}</td>
                  <td className="px-3 py-2 text-right font-bold">{p.points}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{p.goals}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{p.assists}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
