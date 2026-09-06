"use client";

import { useRouter } from "next/navigation";
import type { TopScorer } from "@/lib/types";
import { DataTable, type Column } from "./ui/DataTable";

export function TopScorersTable({
  rows,
  squadCodes,
}: {
  rows: TopScorer[];
  squadCodes: number[];
}) {
  const router = useRouter();
  const owned = new Set(squadCodes);

  const columns: Column<TopScorer>[] = [
    {
      key: "rank",
      header: "#",
      render: (_r, i) => <span className="text-fg-subtle">{i + 1}</span>,
    },
    {
      key: "player",
      header: "Player",
      sortValue: (r) => r.player,
      render: (r) => (
        <span className="flex items-center gap-1.5">
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
    <DataTable
      data={rows}
      columns={columns}
      rowKey={(r) => r.playerCode}
      initialSort={{ key: "points", dir: "desc" }}
      onRowClick={(r) => router.push(`/players/${r.playerCode}`)}
    />
  );
}
