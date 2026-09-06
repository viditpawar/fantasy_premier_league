"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlayerSeasonRow, Position } from "@/lib/types";
import { DataTable, type Column } from "./ui/DataTable";
import { Sparkline } from "./ui/Sparkline";
import { SegmentedControl } from "./ui/SegmentedControl";
import { money, compactNumber } from "@/lib/format";

const POSITIONS: (Position | "ALL")[] = ["ALL", "GKP", "DEF", "MID", "FWD"];

const STATUS_DOT: Record<string, string> = {
  a: "var(--good)",
  d: "var(--warning)",
  i: "var(--critical)",
  s: "var(--critical)",
  u: "var(--fg-subtle)",
  n: "var(--fg-subtle)",
};

export function PlayerExplorer({
  players,
  teams,
}: {
  players: PlayerSeasonRow[];
  teams: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<Position | "ALL">("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [ownedOnly, setOwnedOnly] = useState(false);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return players.filter((p) => {
      if (query && !p.player.toLowerCase().includes(query)) return false;
      if (pos !== "ALL" && p.position !== pos) return false;
      if (teamFilter !== "ALL" && p.team !== teamFilter) return false;
      if (availableOnly && p.status !== "a") return false;
      if (ownedOnly && !p.inSquad) return false;
      return true;
    });
  }, [players, q, pos, teamFilter, availableOnly, ownedOnly]);

  const columns: Column<PlayerSeasonRow>[] = [
    {
      key: "player",
      header: "Player",
      sortValue: (p) => p.player,
      render: (p) => (
        <span className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: STATUS_DOT[p.status] ?? "var(--fg-subtle)" }}
          />
          <span className="font-semibold text-fg">{p.player}</span>
          <span className="text-xs text-fg-subtle">
            {p.team} · {p.position}
          </span>
          {p.inSquad && (
            <span className="rounded bg-accent/15 px-1 text-[10px] font-bold text-accent">OWN</span>
          )}
        </span>
      ),
    },
    {
      key: "price",
      header: "£",
      align: "right",
      sortValue: (p) => p.nowCost,
      render: (p) => <span className="tabular-nums text-fg-muted">{money(p.nowCost)}</span>,
    },
    {
      key: "pts",
      header: "Pts",
      align: "right",
      sortValue: (p) => p.totalPoints,
      render: (p) => <span className="font-extrabold tabular-nums text-fg">{p.totalPoints}</span>,
    },
    {
      key: "form",
      header: "Form",
      align: "right",
      hideBelow: "sm",
      sortValue: (p) => p.form5,
      render: (p) => (
        <span className="inline-flex items-center gap-1.5">
          {p.formSeries.length > 1 && <Sparkline data={p.formSeries} width={44} height={16} />}
          <span className="tabular-nums text-fg-muted">{p.form5}</span>
        </span>
      ),
    },
    {
      key: "ppm",
      header: "Pts/£m",
      align: "right",
      hideBelow: "md",
      sortValue: (p) => p.pointsPerMillion,
      render: (p) => <span className="tabular-nums text-fg-muted">{p.pointsPerMillion.toFixed(1)}</span>,
    },
    {
      key: "goals",
      header: "G",
      align: "right",
      hideBelow: "lg",
      sortValue: (p) => p.goals,
      render: (p) => <span className="tabular-nums text-fg-muted">{p.goals}</span>,
    },
    {
      key: "assists",
      header: "A",
      align: "right",
      hideBelow: "lg",
      sortValue: (p) => p.assists,
      render: (p) => <span className="tabular-nums text-fg-muted">{p.assists}</span>,
    },
    {
      key: "ict",
      header: "ICT",
      align: "right",
      hideBelow: "lg",
      sortValue: (p) => p.ictIndex,
      render: (p) => <span className="tabular-nums text-fg-muted">{p.ictIndex.toFixed(1)}</span>,
    },
    {
      key: "own",
      header: "TSB",
      align: "right",
      hideBelow: "lg",
      sortValue: (p) => p.ownership ?? -1,
      render: (p) => (
        <span className="tabular-nums text-fg-muted">
          {p.ownership != null ? compactNumber(p.ownership) : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search players…"
          className="h-9 min-w-[10rem] flex-1 rounded-lg border border-border bg-surface-1 px-3 text-sm outline-none focus:border-border-strong"
        />
        <SegmentedControl
          size="sm"
          value={pos}
          onChange={setPos}
          options={POSITIONS.map((p) => ({ label: p, value: p }))}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="h-8 rounded-lg border border-border bg-surface-1 px-2 outline-none"
        >
          <option value="ALL">All teams</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
          />
          Available only
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={ownedOnly} onChange={(e) => setOwnedOnly(e.target.checked)} />
          In my squad
        </label>
        <span className="ml-auto text-fg-subtle">{filtered.length} players</span>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(p) => p.playerCode}
        dense
        initialSort={{ key: "pts", dir: "desc" }}
        onRowClick={(p) => router.push(`/players/${p.playerCode}`)}
      />
    </div>
  );
}
