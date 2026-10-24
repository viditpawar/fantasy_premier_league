"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TopScorer } from "@/lib/types";
import { DataTable, type Column } from "./ui/DataTable";
import { PlayerKit } from "./PlayerKit";

export function TopScorersTable({
  rows,
  squadCodes,
}: {
  rows: TopScorer[];
  squadCodes: number[];
}) {
  const router = useRouter();
  const owned = new Set(squadCodes);
  const seasonRank = new Map([...rows].sort((a, b) => b.points - a.points).map((row, index) => [row.playerCode, index + 1]));
  const [scope, setScope] = useState<"all" | "owned" | "outside">("all");
  const filtered = rows.filter((row) => scope === "all" || (scope === "owned" ? owned.has(row.playerCode) : !owned.has(row.playerCode)));

  const columns: Column<TopScorer>[] = [
    {
      key: "rank",
      header: "#",
      render: (row) => <span className="text-fg-subtle">{seasonRank.get(row.playerCode)}</span>,
    },
    {
      key: "player",
      header: "Player",
      sortValue: (r) => r.player,
      render: (r) => (
        <span className="flex items-center gap-2">
          <PlayerKit code={r.teamCode} className="h-7 w-7 shrink-0" />
          <span className="font-semibold text-fg">{r.player}</span>
          <span className="text-xs text-fg-subtle">{r.team}</span>
          {owned.has(r.playerCode) && (
            <span className="rounded bg-accent/15 px-1 text-[10px] font-bold text-accent">OWN</span>
          )}
        </span>
      ),
    },
    {
      key: "points",
      header: "Pts",
      align: "right",
      sortValue: (r) => r.points,
      render: (r) => <span className="font-extrabold tabular-nums text-fg">{r.points}</span>,
    },
    {
      key: "goals",
      header: "G",
      align: "right",
      hideBelow: "sm",
      sortValue: (r) => r.goals,
      render: (r) => <span className="tabular-nums text-fg-muted">{r.goals}</span>,
    },
    {
      key: "assists",
      header: "A",
      align: "right",
      hideBelow: "sm",
      sortValue: (r) => r.assists,
      render: (r) => <span className="tabular-nums text-fg-muted">{r.assists}</span>,
    },
  ];

  return (
    <div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="analytics-period" role="group" aria-label="Top scorers scope">{([{ value: "all", label: "All top scorers" }, { value: "owned", label: "In my squad" }, { value: "outside", label: "Outside my squad" }] as const).map((option) => <button key={option.value} aria-pressed={scope === option.value} onClick={() => setScope(option.value)}>{option.label}</button>)}</div>
      <span className="text-[10px] text-fg-muted">{filtered.length} of the season’s top {rows.length}</span>
    </div>
    <DataTable
      data={filtered}
      columns={columns}
      rowKey={(r) => r.playerCode}
      initialSort={{ key: "points", dir: "desc" }}
      onRowClick={(r) => router.push(`/players/${r.playerCode}`)}
      emptyLabel="No players in the season’s leading scorers match this view."
    />
    </div>
  );
}
