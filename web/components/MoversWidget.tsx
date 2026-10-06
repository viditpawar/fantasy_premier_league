import type { TransferMover } from "@/lib/types";
import { compactNumber, money } from "@/lib/format";

const SHIRT_URL = (code: number) =>
  `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}-66.png`;

function MoverRow({ m, tone }: { m: TransferMover; tone: "in" | "out" }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={SHIRT_URL(m.teamCode)} alt="" className="h-6 w-6 shrink-0 object-contain" />
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
        {tone === "in" ? "+" : "-"}
        {compactNumber(tone === "in" ? m.transfersIn : m.transfersOut)}
      </span>
    </div>
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
          <span className="section-label">Most transferred in</span>
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
          <span className="section-label">Most transferred out</span>
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
