"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlayerSeasonRow, Position } from "@/lib/types";
import { DataTable, type Column } from "./ui/DataTable";
import { Sparkline } from "./ui/Sparkline";
import { SegmentedControl } from "./ui/SegmentedControl";
import { PlayerTile } from "./PlayerTile";
import { CompareBar } from "./CompareBar";
import { IconGrid, IconList, IconSearch } from "./icons";
import { money } from "@/lib/format";

const SHIRT_URL = (code: number) =>
  `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}-66.png`;

const POSITIONS: (Position | "ALL")[] = ["ALL", "GKP", "DEF", "MID", "FWD"];
const MAX_COMPARE = 4;

const STATUS_DOT: Record<string, string> = {
  a: "var(--good)",
  d: "var(--warning)",
  i: "var(--critical)",
  s: "var(--critical)",
  u: "var(--fg-subtle)",
  n: "var(--fg-subtle)",
};

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        checked
          ? "border-accent/50 bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-accent"
          : "border-border text-fg-muted hover:border-border-strong"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full transition-colors ${checked ? "bg-accent" : "bg-fg-subtle"}`}
      />
      {label}
    </button>
  );
}

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
  const [selected, setSelected] = useState<number[]>([]);
  const [view, setView] = useState<"table" | "cards">("cards");

  const toggleSelected = (code: number) => {
    setSelected((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : prev.length < MAX_COMPARE
          ? [...prev, code]
          : prev,
    );
  };

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

  const sortedForCards = useMemo(
    () => [...filtered].sort((a, b) => b.totalPoints - a.totalPoints),
    [filtered],
  );

  const columns: Column<PlayerSeasonRow>[] = [
    {
      key: "select",
      header: "",
      render: (p) => (
        <input
          type="checkbox"
          checked={selected.includes(p.playerCode)}
          disabled={!selected.includes(p.playerCode) && selected.length >= MAX_COMPARE}
          onClick={(e) => e.stopPropagation()}
          onChange={() => toggleSelected(p.playerCode)}
          className="h-3.5 w-3.5 accent-[var(--accent)]"
          aria-label={`Select ${p.player} to compare`}
        />
      ),
    },
    {
      key: "player",
      header: "Player",
      sortValue: (p) => p.player,
      render: (p) => (
        <span className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={SHIRT_URL(p.teamCode)} alt="" className="h-5 w-5 shrink-0 object-contain" />
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
          {p.ownership != null ? `${p.ownership.toFixed(1)}%` : "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="glass sticky top-0 z-10 -mx-4 flex flex-col gap-2.5 border-b border-border px-4 py-3 sm:mx-0 sm:rounded-2xl sm:border">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[10rem] flex-1">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search players…"
              className="h-9 w-full rounded-full border border-border bg-surface-1 pl-9 pr-3 text-sm outline-none transition-colors focus:border-accent"
            />
          </div>
          <SegmentedControl
            size="sm"
            value={pos}
            onChange={setPos}
            options={POSITIONS.map((p) => ({ label: p, value: p }))}
          />
          <div className="ml-auto flex items-center gap-1 rounded-full border border-border bg-surface-1 p-0.5">
            <button
              onClick={() => setView("cards")}
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                view === "cards" ? "bg-accent text-[var(--accent-contrast)]" : "text-fg-subtle hover:text-fg"
              }`}
              aria-label="Card view"
            >
              <IconGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView("table")}
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                view === "table" ? "bg-accent text-[var(--accent-contrast)]" : "text-fg-subtle hover:text-fg"
              }`}
              aria-label="Table view"
            >
              <IconList className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="h-8 rounded-full border border-border bg-surface-1 px-3 text-xs outline-none transition-colors focus:border-accent"
          >
            <option value="ALL">All teams</option>
            {teams.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <Toggle checked={availableOnly} onChange={setAvailableOnly} label="Available only" />
          <Toggle checked={ownedOnly} onChange={setOwnedOnly} label="In my squad" />
          <span className="ml-auto text-xs text-fg-subtle">{filtered.length} players</span>
        </div>
      </div>

      {view === "cards" ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {sortedForCards.map((p) => (
            <PlayerTile
              key={p.playerCode}
              player={p}
              selected={selected.includes(p.playerCode)}
              onToggleSelect={() => toggleSelected(p.playerCode)}
              onOpen={() => router.push(`/players/${p.playerCode}`)}
            />
          ))}
          {sortedForCards.length === 0 && (
            <div className="col-span-full py-10 text-center text-sm text-fg-subtle">
              No players match your filters.
            </div>
          )}
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          rowKey={(p) => p.playerCode}
          dense
          initialSort={{ key: "pts", dir: "desc" }}
          onRowClick={(p) => router.push(`/players/${p.playerCode}`)}
        />
      )}

      <CompareBar selectedCodes={selected} max={MAX_COMPARE} onClear={() => setSelected([])} />
    </div>
  );
}
