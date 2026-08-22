import { SquadPlayer } from "@/lib/types";
import { teamColor } from "@/lib/teamColors";

const STATUS_LABELS: Record<string, string> = {
  d: "Doubtful",
  i: "Injured",
  s: "Suspended",
  u: "Unavailable",
  n: "Not available",
};

function difficultyClass(diff: number | null | undefined): string {
  if (diff == null) return "text-gray-400";
  if (diff <= 2) return "text-green-500";
  if (diff === 3) return "text-amber-500";
  return "text-red-500";
}

export function PlayerCard({ player }: { player: SquadPlayer }) {
  const fixture = player.upcomingFixtures[0];
  const fixtureText = fixture ? `${fixture.opponent} (${fixture.wasHome ? "H" : "A"})` : "No fixture";
  const isUnavailable = player.status && player.status !== "a";

  return (
    <div className="relative w-20 sm:w-24 text-center group">
      {player.isCaptain && (
        <span
          className="absolute -top-1.5 right-3 z-10 flex h-[19px] w-[19px] items-center justify-center rounded-full bg-cyan-400 text-[11px] font-extrabold text-slate-900 shadow"
          title="Captain"
        >
          C
        </span>
      )}
      {player.isViceCaptain && (
        <span
          className="absolute -top-1.5 right-3 z-10 flex h-[19px] w-[19px] items-center justify-center rounded-full bg-gray-300 text-[11px] font-extrabold text-slate-900 shadow"
          title="Vice-captain"
        >
          V
        </span>
      )}
      {isUnavailable && (
        <span
          className="absolute -top-1.5 left-3 z-10 flex h-[18px] w-[18px] cursor-help items-center justify-center rounded-full bg-red-500 text-[12px] font-extrabold text-white shadow"
          title={player.news || STATUS_LABELS[player.status] || "Flagged"}
        >
          !
        </span>
      )}

      <div
        className="mx-auto mb-1.5 h-[50px] w-[46px] shadow-md transition-transform group-hover:-translate-y-0.5"
        style={{
          background: teamColor(player.team),
          clipPath:
            "polygon(30% 0%, 70% 0%, 70% 10%, 100% 22%, 86% 42%, 70% 32%, 70% 100%, 30% 100%, 30% 32%, 14% 42%, 0% 22%, 30% 10%)",
        }}
      />

      <div className="rounded-md bg-white px-1.5 py-1 text-[11.5px] leading-tight shadow">
        <div className="truncate font-bold text-slate-900">{player.player}</div>
        <div className={`font-semibold ${difficultyClass(fixture?.difficulty)}`}>{fixtureText}</div>
      </div>
      <div className="rounded-b-md bg-[#37003c] py-0.5 text-[11px] font-bold text-white">
        {player.lastGameweekPoints} pts
      </div>
    </div>
  );
}
