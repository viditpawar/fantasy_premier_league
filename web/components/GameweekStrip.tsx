"use client";

import { useEffect, useState } from "react";
import { countdown, countdownLabel } from "@/lib/format";

export interface GameweekStripProps {
  gwName: string;
  deadline: string | null;
  averageScore: number | null;
  highestScore: number | null;
  phase: "live" | "upcoming" | "done";
  liveTotal?: number | null;
}

export function GameweekStrip({
  gwName,
  deadline,
  averageScore,
  highestScore,
  phase,
  liveTotal,
}: GameweekStripProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (phase !== "upcoming") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const cd = countdown(deadline, now);

  return (
    <div className="border-b border-border bg-surface-1/60">
      <div className="mx-auto flex max-w-6xl items-center gap-x-4 gap-y-1 overflow-x-auto px-4 py-1.5 text-xs">
        <span className="flex items-center gap-1.5 font-bold text-fg">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background:
                phase === "live" ? "var(--accent)" : phase === "upcoming" ? "var(--warning)" : "var(--fg-subtle)",
            }}
          />
          {gwName}
        </span>

        {phase === "upcoming" && (
          <span className="whitespace-nowrap text-fg-muted" suppressHydrationWarning>
            Deadline <span className="font-semibold text-fg">{countdownLabel(cd)}</span>
          </span>
        )}
        {phase === "live" && (
          <>
            <span className="whitespace-nowrap font-semibold text-accent">● Live</span>
            {liveTotal != null && (
              <span className="whitespace-nowrap text-fg-muted">
                Your GW <span className="font-semibold text-fg">{liveTotal} pts</span>
              </span>
            )}
          </>
        )}
        {averageScore != null && (
          <span className="whitespace-nowrap text-fg-muted">
            Avg <span className="font-semibold text-fg">{averageScore}</span>
          </span>
        )}
        {highestScore != null && highestScore > 0 && (
          <span className="whitespace-nowrap text-fg-muted">
            Top <span className="font-semibold text-fg">{highestScore}</span>
          </span>
        )}
      </div>
    </div>
  );
}
