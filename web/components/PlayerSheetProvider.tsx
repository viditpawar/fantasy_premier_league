"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import Link from "next/link";
import { Sheet } from "./ui/Sheet";
import { FDRCell } from "./ui/FDRCell";
import { Badge } from "./ui/Badge";
import type { SquadPlayer } from "@/lib/types";
import { money } from "@/lib/format";

interface Ctx {
  open: (player: SquadPlayer) => void;
}

const PlayerSheetContext = createContext<Ctx | null>(null);

export function usePlayerSheet() {
  const ctx = useContext(PlayerSheetContext);
  if (!ctx) throw new Error("usePlayerSheet must be used within PlayerSheetProvider");
  return ctx;
}

const STATUS_LABELS: Record<string, string> = {
  d: "Doubtful",
  i: "Injured",
  s: "Suspended",
  u: "Unavailable",
  n: "Not in squad",
};

const SHIRT_URL = (code: number) =>
  `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}-66.png`;

export function PlayerSheetProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<SquadPlayer | null>(null);

  return (
    <PlayerSheetContext.Provider value={{ open: setPlayer }}>
      {children}
      <Sheet open={player != null} onClose={() => setPlayer(null)} title={player?.player}>
        {player && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={SHIRT_URL(player.teamCode)} alt="" className="h-12 w-12 object-contain" />
              <div>
                <div className="text-lg font-extrabold text-fg">{player.player}</div>
                <div className="text-sm text-fg-muted">
                  {player.team} · {player.position} · {money(player.nowCost)}
                </div>
                <div className="mt-1 flex gap-1.5">
                  {player.isCaptain && <Badge tone="accent">Captain</Badge>}
                  {player.isViceCaptain && <Badge tone="neutral">Vice</Badge>}
                  {player.multiplier === 0 && <Badge tone="neutral">Bench</Badge>}
                  {player.status !== "a" && (
                    <Badge tone="critical">{STATUS_LABELS[player.status] ?? "Flagged"}</Badge>
                  )}
                </div>
              </div>
            </div>

            {player.news && (
              <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg-muted">
                {player.news}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="card px-3 py-2.5">
                <div className="text-xl font-extrabold text-fg">{player.lastGameweekPoints}</div>
                <div className="section-label">Last GW points</div>
              </div>
              <div className="card px-3 py-2.5">
                <div className="text-xl font-extrabold text-fg">{money(player.nowCost)}</div>
                <div className="section-label">Price</div>
              </div>
            </div>

            <div>
              <h3 className="section-label mb-1.5">Next fixtures</h3>
              <div className="flex flex-wrap gap-1.5">
                {player.upcomingFixtures.length === 0 && (
                  <span className="text-sm text-fg-muted">No upcoming fixtures</span>
                )}
                {player.upcomingFixtures.map((f, i) => (
                  <FDRCell key={i} opponent={f.opponent} wasHome={f.wasHome} difficulty={f.difficulty} />
                ))}
              </div>
            </div>

            <Link
              href={`/players/${player.playerCode}`}
              className="rounded-lg bg-accent px-3 py-2 text-center text-sm font-bold text-accent-contrast"
            >
              Full profile →
            </Link>
          </div>
        )}
      </Sheet>
    </PlayerSheetContext.Provider>
  );
}
