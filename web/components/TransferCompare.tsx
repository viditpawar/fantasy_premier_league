import type { PlayerSeasonRow, SuggestedTransfer } from "@/lib/types";
import { Badge } from "./ui/Badge";
import { money } from "@/lib/format";

function Bar({
  label,
  outVal,
  inVal,
  fmt = (n) => String(n),
  higherIsBetter = true,
}: {
  label: string;
  outVal: number;
  inVal: number;
  fmt?: (n: number) => string;
  higherIsBetter?: boolean;
}) {
  const max = Math.max(Math.abs(outVal), Math.abs(inVal), 1);
  const inBetter = higherIsBetter ? inVal >= outVal : inVal <= outVal;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
      <div className="flex items-center justify-end gap-2">
        <span className="tabular-nums text-fg-muted">{fmt(outVal)}</span>
        <div className="h-1.5 w-full max-w-[80px] overflow-hidden rounded-full bg-surface-2">
          <div
            className="ml-auto h-full rounded-full bg-[var(--critical)]"
            style={{ width: `${(Math.abs(outVal) / max) * 100}%` }}
          />
        </div>
      </div>
      <span className="section-label whitespace-nowrap">{label}</span>
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-full max-w-[80px] overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full"
            style={{
              width: `${(Math.abs(inVal) / max) * 100}%`,
              background: inBetter ? "var(--good)" : "var(--fg-subtle)",
            }}
          />
        </div>
        <span className="tabular-nums text-fg-muted">{fmt(inVal)}</span>
      </div>
    </div>
  );
}

export function TransferCompare({
  transfer,
  rank,
  hit,
  byName,
}: {
  transfer: SuggestedTransfer;
  rank?: number;
  hit?: boolean;
  byName: Map<string, PlayerSeasonRow>;
}) {
  const out = byName.get(transfer.player_out.toLowerCase());
  const inc = byName.get(transfer.player_in.toLowerCase());

  return (
    <div
      className="card px-4 py-3.5"
      style={rank === 1 ? { boxShadow: "inset 3px 0 0 var(--accent), var(--shadow-card)" } : undefined}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {rank != null && (
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-extrabold"
            style={
              rank === 1
                ? { background: "var(--accent)", color: "var(--accent-contrast)" }
                : { background: "var(--surface-2)", color: "var(--fg-muted)" }
            }
          >
            {rank}
          </span>
        )}
        <Badge tone="brand">{transfer.position}</Badge>
        <span className="font-semibold text-[var(--critical)] line-through decoration-2">
          {transfer.player_out}
        </span>
        <span className="text-fg-subtle">→</span>
        <span className="font-bold text-[var(--good)]">{transfer.player_in}</span>
        {hit && (
          <Badge tone="warning" className="ml-auto">
            -4 pts
          </Badge>
        )}
      </div>

      {out && inc && (
        <div className="mb-2.5 flex flex-col gap-1.5 rounded-lg bg-surface-2/50 px-3 py-2.5">
          <Bar label="Form (5)" outVal={out.form5} inVal={inc.form5} />
          <Bar label="Total pts" outVal={out.totalPoints} inVal={inc.totalPoints} />
          <Bar
            label="Price"
            outVal={out.nowCost}
            inVal={inc.nowCost}
            fmt={money}
            higherIsBetter={false}
          />
          <Bar
            label="Pts / £m"
            outVal={out.pointsPerMillion}
            inVal={inc.pointsPerMillion}
            fmt={(n) => n.toFixed(1)}
          />
        </div>
      )}

      <p className="text-sm text-fg-muted">{transfer.reasoning}</p>
    </div>
  );
}
