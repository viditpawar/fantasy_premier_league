"use client";

import { SquadPlayer } from "@/lib/types";
import { fdrColor } from "@/lib/format";
import { usePlayerSheet } from "./PlayerSheetProvider";

const SHIRT_URL = (code: number) =>
  `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}-66.png`;

const STATUS_LABELS: Record<string, string> = {
  d: "Doubtful",
  i: "Injured",
  s: "Suspended",
  u: "Unavailable",
  n: "Not available",
};

export function PlayerCard({ player, live }: { player: SquadPlayer; live?: number }) {
  const { open } = usePlayerSheet();
  const fixture = player.upcomingFixtures[0];
  const fixtureText = fixture ? `${fixture.opponent} (${fixture.wasHome ? "H" : "A"})` : "No fixture";
  const isUnavailable = player.status && player.status !== "a";
  // FPL shows the captain's doubled score on the pitch; bench players show raw.
  const points = (live ?? player.lastGameweekPoints) * (player.multiplier || 1);

  return (
    <button
      onClick={() => open(player)}
      className="group relative w-[3.5rem] text-center sm:w-[5rem]"
    >
      {player.isCaptain && (
        <span
          className="absolute -top-1.5 right-2.5 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] font-extrabold shadow ring-2 ring-black/20"
          style={{ background: "var(--accent)", color: "var(--accent-contrast)" }}
          title="Captain"
        >
          C
        </span>
      )}
      {player.isViceCaptain && (
        <span
          className="absolute -top-1.5 right-2.5 z-10 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface-3 text-[11px] font-extrabold text-fg shadow ring-2 ring-black/20"
          title="Vice-captain"
        >
          V
        </span>
      )}
      {isUnavailable && (
        <span
          className="absolute -top-1.5 left-2.5 z-10 flex h-[17px] w-[17px] items-center justify-center rounded-full text-[11px] font-extrabold text-white shadow"
          style={{ background: "var(--critical)" }}
          title={player.news || STATUS_LABELS[player.status] || "Flagged"}
        >
          !
        </span>
      )}

      <div className="relative mx-auto mb-1 flex h-10 w-10 items-center justify-center">
        <div className="absolute inset-0 scale-90 rounded-full bg-black/20 blur-sm transition-transform duration-200 group-hover:scale-100" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SHIRT_URL(player.teamCode)}
          alt={`${player.team} shirt`}
          className="relative h-10 w-10 object-contain drop-shadow-[0_4px_6px_rgba(0,0,0,0.35)] transition-transform duration-200 group-hover:-translate-y-0.5"
          loading="lazy"
        />
      </div>

      <div className="overflow-hidden rounded-md bg-surface-1 text-[11px] leading-tight shadow-[var(--shadow-card)]">
        <div className="truncate px-1 pt-1 font-bold text-fg">{player.player}</div>
        <div className="flex items-center justify-center gap-1 px-1 pb-1 font-semibold text-fg-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: fdrColor(fixture?.difficulty) }} />
          <span className="truncate">{fixtureText}</span>
        </div>
        <div
          className="py-0.5 text-[11px] font-extrabold"
          style={{
            background: live != null ? "var(--accent)" : "var(--brand-purple)",
            color: live != null ? "var(--accent-contrast)" : "#fff",
          }}
        >
          {points} {live != null ? "live" : "pts"}
        </div>
      </div>
    </button>
  );
}
