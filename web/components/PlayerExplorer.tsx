"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PlayerSeasonRow, Position } from "@/lib/types";
import { DataTable, type Column } from "./ui/DataTable";
import { Sparkline } from "./ui/Sparkline";
import { SegmentedControl } from "./ui/SegmentedControl";
import { PlayerTile } from "./PlayerTile";
import { PlayerKit } from "./PlayerKit";
import { CompareBar } from "./CompareBar";
import { IconGrid, IconList, IconSearch } from "./icons";
import { money } from "@/lib/format";
import { parseMillions } from "@/lib/planning";
import { parseWatchlist, useLocalState, useWatchlist } from "@/lib/local-state";
import { WatchlistButton } from "./WatchlistButton";
import Link from "next/link";

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
      aria-pressed={checked}
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
  season,
  onlyWatchlist = false,
}: {
  players: PlayerSeasonRow[];
  teams: string[];
  season: string;
  onlyWatchlist?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<Position | "ALL">("ALL");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [watchlist, , temporary] = useWatchlist(season);
  const [savedOnly, setSavedOnly] = useState(onlyWatchlist);
  const [maxPrice, setMaxPrice] = useState("");
  const [minMinutes, setMinMinutes] = useState("");
  const [maxOwnership, setMaxOwnership] = useState("");
  const [selected, setSelected] = useLocalState(`fpl:compare:${season}`, [] as number[], value => parseWatchlist(value).filter(code => players.some(p => p.playerCode === code)).slice(0, MAX_COMPARE));
  const [cardLimit, setCardLimit] = useState(48);
  const [view, setView] = useState<"table" | "cards">("table");

  const toggleSelected = (code: number) => {
    setSelected(selected.includes(code) ? selected.filter(c => c !== code) : selected.length < MAX_COMPARE ? [...selected, code] : selected);
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return players.filter((p) => {
      if (query && !p.player.toLowerCase().includes(query)) return false;
      if (pos !== "ALL" && p.position !== pos) return false;
      if (teamFilter !== "ALL" && p.team !== teamFilter) return false;
      if (availableOnly && p.status !== "a") return false;
      if (ownedOnly && !p.inSquad) return false;
      if ((onlyWatchlist || savedOnly) && !watchlist.includes(p.playerCode)) return false;
      if (maxPrice !== "" && (parseMillions(maxPrice) == null || p.nowCost > parseMillions(maxPrice)!)) return false;
      if (minMinutes !== "" && p.minutes < Number(minMinutes)) return false;
      if (maxOwnership !== "" && (p.ownership == null || p.ownership > Number(maxOwnership))) return false;
      return true;
    });
  }, [players, q, pos, teamFilter, availableOnly, ownedOnly, onlyWatchlist, savedOnly, watchlist, maxPrice, minMinutes, maxOwnership]);

  const sortedForCards = useMemo(
    () => [...filtered].sort((a, b) => b.totalPoints - a.totalPoints),
    [filtered],
  );

  const columns: Column<PlayerSeasonRow>[] = [
    { key: "save", header: <span className="sr-only">Watchlist</span>, render: p => <WatchlistButton season={season} code={p.playerCode} name={p.player} compact /> },
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
          <PlayerKit code={p.teamCode} goalkeeper={p.position === "GKP"} className="h-7 w-7 shrink-0" />
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
      <div className="card sticky top-[67px] z-10 flex flex-col gap-3 p-4 md:top-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[10rem] flex-1">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <input
              aria-label="Search players by name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search players…"
              className="h-10 w-full rounded-xl border border-border bg-surface-0 pl-9 pr-3 text-xs outline-none transition-colors focus:border-accent"
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
              aria-pressed={view === "cards"}
            >
              <IconGrid className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setView("table")}
              className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                view === "table" ? "bg-accent text-[var(--accent-contrast)]" : "text-fg-subtle hover:text-fg"
              }`}
              aria-label="Table view"
              aria-pressed={view === "table"}
            >
              <IconList className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by club"
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
          {!onlyWatchlist && <Toggle checked={savedOnly} onChange={setSavedOnly} label="Watchlist" />}
          <span className="ml-auto text-xs text-fg-subtle">{filtered.length} players</span>
        </div>
      </div>

      <div className="card grid grid-cols-2 items-end gap-3 p-4 sm:grid-cols-4">
        <label className="text-[10px] text-fg-muted">Maximum price (£m)<input type="number" min="0" max="200" step="0.1" aria-label="Maximum player price" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="field-input mt-1.5" placeholder="Any price" /></label>
        <label className="text-[10px] text-fg-muted">Minimum minutes<input type="number" min="0" step="1" aria-label="Minimum minutes" value={minMinutes} onChange={e => setMinMinutes(e.target.value)} className="field-input mt-1.5" placeholder="Any minutes" /></label>
        <label className="text-[10px] text-fg-muted">Maximum ownership (%)<input type="number" min="0" max="100" step="0.1" aria-label="Maximum ownership" value={maxOwnership} onChange={e => setMaxOwnership(e.target.value)} className="field-input mt-1.5" placeholder="Any ownership" /></label>
        <button className="button-secondary" onClick={() => { setQ(""); setPos("ALL"); setTeamFilter("ALL"); setAvailableOnly(false); setOwnedOnly(false); setSavedOnly(onlyWatchlist); setMaxPrice(""); setMinMinutes(""); setMaxOwnership(""); }}>Reset filters</button>
      </div>
      {temporary && <p role="status" className="text-xs text-warning">Device storage is unavailable. Your shortlist will last for this visit.</p>}
      {onlyWatchlist && watchlist.length === 0 && <div className="card p-8 text-center"><h2 className="text-base font-medium">A shortlist worth coming back to.</h2><p className="mt-3 text-xs leading-6 text-fg-muted">Save players with the star beside their name. Their latest prices and form will appear here.</p><Link href="/players" className="button-primary mt-5">Find players to follow</Link></div>}
      {view === "cards" ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {sortedForCards.slice(0, cardLimit).map((p) => (
            <PlayerTile
              key={p.playerCode}
              player={p}
              season={season}
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
          {sortedForCards.length > cardLimit && <button onClick={() => setCardLimit(n => n + 48)} className="button-secondary col-span-full">Show more players</button>}
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          rowKey={(p) => p.playerCode}
          dense
          pageSize={40}
          initialSort={{ key: "pts", dir: "desc" }}
          onRowClick={(p) => router.push(`/players/${p.playerCode}`)}
        />
      )}

      <CompareBar selectedCodes={selected} max={MAX_COMPARE} onClear={() => setSelected([])} />
    </div>
  );
}
