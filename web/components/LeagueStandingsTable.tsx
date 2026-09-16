"use client";

import type { LeagueStandingRow } from "@/lib/types";
import { DataTable, type Column } from "./ui/DataTable";
import { rankDelta } from "@/lib/format";

const MEDAL: Record<number, string> = { 1: "#f5c542", 2: "#c7cad1", 3: "#d99358" };

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
        const medal = MEDAL[r.rank];
        return (
          <span className="flex items-center gap-1.5">
            {medal ? (
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
                style={{ background: `linear-gradient(135deg, ${medal}, color-mix(in oklab, ${medal} 60%, black))` }}
              >
                {r.rank}
              </span>
            ) : (
              <span className="font-extrabold tabular-nums text-fg">{r.rank}</span>
            )}
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
