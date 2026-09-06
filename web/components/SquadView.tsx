"use client";

import { useState } from "react";
import type { SquadPlayer } from "@/lib/types";
import { PlayerSheetProvider, usePlayerSheet } from "./PlayerSheetProvider";
import { PlayerCard } from "./PlayerCard";
import { SegmentedControl } from "./ui/SegmentedControl";
import { FDRCell } from "./ui/FDRCell";
import { money } from "@/lib/format";

const ROW_ORDER = ["GKP", "DEF", "MID", "FWD"] as const;

function Pitch({ starting, bench, liveByCode }: ViewProps) {
  const rows = ROW_ORDER.map((pos) =>
    starting.filter((p) => p.position === pos).sort((a, b) => a.squadPosition - b.squadPosition),
  ).filter((r) => r.length > 0);

  return (
    <>
      <div
        className="grain relative overflow-hidden rounded-2xl px-3 pb-6 pt-8 shadow-[var(--shadow-pop)]"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, var(--pitch-a) 0%, var(--pitch-b) 55%, color-mix(in oklab, var(--pitch-b) 80%, black) 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.10]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, #fff 0, #fff 2px, transparent 2px, transparent 44px)",
          }}
        />
        <div className="pointer-events-none absolute inset-3 rounded-xl border border-white/15" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15" />
        <div className="pointer-events-none absolute left-1/2 top-3 h-px w-[calc(100%-1.5rem)] -translate-x-1/2 bg-white/15" />
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_90px_28px_rgba(0,0,0,0.28)]" />

        <div className="relative">
          {rows.map((row, i) => (
            <div key={i} className="mb-6 flex flex-wrap justify-evenly gap-1 last:mb-1 sm:gap-2">
              {row.map((p) => (
                <PlayerCard key={p.playerCode} player={p} live={liveByCode?.get(p.playerCode)} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 section-label text-center">Substitutes</div>
      <div className="mt-1.5 flex flex-wrap justify-evenly gap-1.5 rounded-2xl border border-border bg-surface-1 px-2 py-4 sm:gap-3 sm:px-3">
        {bench.map((p, i) => (
          <div key={p.playerCode} className="text-center">
            <div className="mb-1 text-[10px] font-bold uppercase text-fg-subtle">
              {i + 1} · {p.position}
            </div>
            <PlayerCard player={p} live={liveByCode?.get(p.playerCode)} />
          </div>
        ))}
      </div>
    </>
  );
}

function ListRows({ players }: { players: SquadPlayer[] }) {
  const { open } = usePlayerSheet();
  return (
    <div className="card divide-y divide-border overflow-hidden">
      {players.map((p) => {
        const fx = p.upcomingFixtures[0];
        return (
          <button
            key={p.playerCode}
            onClick={() => open(p)}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-surface-2"
          >
            <span className="w-8 shrink-0 text-xs font-bold text-fg-subtle">{p.position}</span>
            <span className="flex-1 truncate font-semibold text-fg">
              {p.player}
              {p.isCaptain && <span className="ml-1 text-accent">(C)</span>}
              {p.isViceCaptain && <span className="ml-1 text-fg-subtle">(V)</span>}
              {p.status !== "a" && <span className="ml-1 text-[var(--critical)]">!</span>}
            </span>
            <span className="w-14 shrink-0 text-right text-fg-muted">{money(p.nowCost)}</span>
            <span className="hidden w-20 shrink-0 justify-end sm:flex">
              {fx && <FDRCell opponent={fx.opponent} wasHome={fx.wasHome} difficulty={fx.difficulty} size="sm" />}
            </span>
            <span className="w-12 shrink-0 text-right font-extrabold tabular-nums text-fg">
              {p.lastGameweekPoints}
            </span>
          </button>
        );
      })}
    </div>
  );
}

interface ViewProps {
  starting: SquadPlayer[];
  bench: SquadPlayer[];
  liveByCode?: Map<number, number>;
}

export function SquadView(props: ViewProps) {
  const [view, setView] = useState<"pitch" | "list">("pitch");
  const all = [...props.starting, ...props.bench].sort((a, b) => a.squadPosition - b.squadPosition);

  return (
    <PlayerSheetProvider>
      <div className="mb-3 flex justify-end">
        <SegmentedControl
          size="sm"
          ariaLabel="Squad view"
          value={view}
          onChange={setView}
          options={[
            { label: "Pitch", value: "pitch" },
            { label: "List", value: "list" },
          ]}
        />
      </div>
      {view === "pitch" ? <Pitch {...props} /> : <ListRows players={all} />}
    </PlayerSheetProvider>
  );
}
