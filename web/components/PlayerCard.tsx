import { SquadPlayer } from "@/lib/types";

const SHIRT_URL = (code: number) =>
  `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}-66.png`;

const STATUS_LABELS: Record<string, string> = {
  d: "Doubtful",
  i: "Injured",
  s: "Suspended",
  u: "Unavailable",
  n: "Not available",
};

function difficultyColor(diff: number | null | undefined): string {
  if (diff == null) return "var(--text-muted)";
  if (diff <= 2) return "var(--status-good)";
  if (diff === 3) return "var(--status-warning)";
  return "var(--status-critical)";
}

export function PlayerCard({ player }: { player: SquadPlayer }) {
  const fixture = player.upcomingFixtures[0];
  const fixtureText = fixture ? `${fixture.opponent} (${fixture.wasHome ? "H" : "A"})` : "No fixture";
  const isUnavailable = player.status && player.status !== "a";

  return (
    <div className="relative w-20 sm:w-24 text-center group">
      {player.isCaptain && (
        <span
          className="absolute -top-1.5 right-3 z-10 flex h-[19px] w-[19px] items-center justify-center rounded-full text-[11px] font-extrabold text-slate-900 shadow ring-2 ring-black/20"
          style={{ background: "var(--accent-green)" }}
          title="Captain"
        >
          C
        </span>
      )}
      {player.isViceCaptain && (
        <span
          className="absolute -top-1.5 right-3 z-10 flex h-[19px] w-[19px] items-center justify-center rounded-full bg-gray-200 text-[11px] font-extrabold text-slate-900 shadow ring-2 ring-black/20"
          title="Vice-captain"
        >
          V
        </span>
      )}
      {isUnavailable && (
        <span
          className="absolute -top-1.5 left-3 z-10 flex h-[18px] w-[18px] cursor-help items-center justify-center rounded-full text-[12px] font-extrabold text-white shadow animate-pulse"
          style={{ background: "var(--status-critical)" }}
          title={player.news || STATUS_LABELS[player.status] || "Flagged"}
        >
          !
        </span>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SHIRT_URL(player.teamCode)}
        alt={`${player.team} shirt`}
        className="mx-auto mb-1.5 h-11 w-11 object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.35)] transition-transform duration-150 group-hover:-translate-y-1"
        loading="lazy"
      />

      <div className="rounded-t-lg bg-white/95 px-1.5 py-1 text-[11.5px] leading-tight shadow-sm backdrop-blur-sm transition-shadow group-hover:shadow-md">
        <div className="truncate font-bold text-slate-900">{player.player}</div>
        <div className="flex items-center justify-center gap-1 font-semibold text-slate-600">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: difficultyColor(fixture?.difficulty) }}
          />
          {fixtureText}
        </div>
      </div>
      <div
        className="rounded-b-lg py-0.5 text-[11px] font-bold text-white"
        style={{ background: "linear-gradient(90deg, var(--accent-purple), var(--accent-purple-bright))" }}
      >
        {player.lastGameweekPoints} pts
      </div>
    </div>
  );
}
