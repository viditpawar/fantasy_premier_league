"use client";

import type { LeagueStandingRow } from "@/lib/types";
import { DataTable, type Column } from "./ui/DataTable";
import { rankDelta } from "@/lib/format";

export function LeagueStandingsTable({
  rows,
  teamId,
}: {
  rows: LeagueStandingRow[];
  teamId: number;
}) {
  const columns: Column<LeagueStandingRow>[] = [
    {
      key: "rank",
      header: "#",
      align: "left",
      sortValue: (r) => r.rank,
      render: (r) => {
        const rd = rankDelta(r.rank, r.lastRank);
        return (
          <span className="flex items-center gap-1.5">
            <span className="font-extrabold tabular-nums text-fg">{r.rank}</span>
            {rd && rd.direction !== "same" && (
              <span
                className="text-[10px] font-bold"
                style={{ color: rd.direction === "up" ? "var(--good)" : "var(--critical)" }}
              >
                {rd.direction === "up" ? "▲" : "▼"}
                {rd.value}
              </span>
            )}
          </span>
        );
      },
    },
    {
      key: "team",
      header: "Team",
      sortValue: (r) => r.entryName,
      render: (r) => (
        <span className="truncate">
          <span className={`font-semibold ${r.entryTeamId === teamId ? "text-accent" : "text-fg"}`}>
            {r.entryName}
          </span>
          <span className="ml-1.5 text-xs text-fg-subtle">{r.playerName}</span>
        </span>
      ),
    },
    {
      key: "gw",
      header: "GW",
      align: "right",
      hideBelow: "sm",
      sortValue: (r) => r.eventTotal ?? 0,
      render: (r) => <span className="tabular-nums text-fg-muted">{r.eventTotal ?? "—"}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      sortValue: (r) => r.total,
      render: (r) => <span className="font-extrabold tabular-nums text-fg">{r.total}</span>,
    },
  ];

  return (
    <DataTable
      data={rows}
      columns={columns}
      rowKey={(r) => r.entryTeamId}
      dense
      initialSort={{ key: "rank", dir: "asc" }}
      rowClassName={(r) =>
        r.entryTeamId === teamId ? "bg-[color-mix(in_oklab,var(--accent)_12%,transparent)]" : ""
      }
    />
  );
}
