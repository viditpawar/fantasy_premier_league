import type { TransferMover } from "@/lib/types";
import { compactNumber, money } from "@/lib/format";
import Link from "next/link";
import { PlayerKit } from "./PlayerKit";

function MoverRow({ m, tone }: { m: TransferMover; tone: "in" | "out" }) {
  return (
    <Link href={`/players/${m.playerCode}`} className="flex items-center gap-2.5 px-4 py-3 transition-colors hover:bg-surface-0">
      <PlayerKit code={m.teamCode} goalkeeper={m.position === "GKP"} className="h-8 w-8 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-fg">{m.player}</div>
        <div className="text-[11px] text-fg-subtle">
          {m.position} · {money(m.price * 10)}
        </div>
      </div>
      <span
        className="shrink-0 text-xs font-extrabold tabular-nums"
        style={{ color: tone === "in" ? "var(--good)" : "var(--critical)" }}
      >
        {m.net > 0 ? "+" : "−"}{compactNumber(Math.abs(m.net))}
      </span>
    </Link>
  );
}

export function MoversWidget({
  risers,
  fallers,
}: {
  risers: TransferMover[];
  fallers: TransferMover[];
}) {
  if (risers.length === 0 && fallers.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      <div className="card card-hover overflow-hidden">
        <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--good)" }} />
          <span className="section-label">Gaining managers · net transfers</span>
        </div>
        <div className="divide-y divide-border">
          {risers.map((m) => (
            <MoverRow key={m.playerCode} m={m} tone="in" />
          ))}
        </div>
      </div>
      <div className="card card-hover overflow-hidden">
        <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--critical)" }} />
          <span className="section-label">Losing managers · net transfers</span>
        </div>
        <div className="divide-y divide-border">
          {fallers.map((m) => (
            <MoverRow key={m.playerCode} m={m} tone="out" />
          ))}
        </div>
      </div>
    </div>
  );
}
