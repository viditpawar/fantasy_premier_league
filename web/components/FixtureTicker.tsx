"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { TickerFixture, TickerTeam } from "@/lib/queries";
import { fixtureRun, fixturesForTeam } from "@/lib/planning";
import { CREST_URL, fdrColor } from "@/lib/format";
import { SegmentedControl } from "./ui/SegmentedControl";
import { FDRCell } from "./ui/FDRCell";
import { IconStar } from "./icons";

type Mode = "overall" | "attack" | "defence";
function strengthFdr(n: number) { return n >= 1320 ? 5 : n >= 1230 ? 4 : n >= 1140 ? 3 : n >= 1060 ? 2 : 1; }

export function FixtureTicker({ teams, fixtures, gameweeks, owned }: {
  teams: TickerTeam[]; fixtures: TickerFixture[]; gameweeks: number[]; owned: number[];
}) {
  const [win, setWin] = useState(5);
  const [start, setStart] = useState(gameweeks[0] ?? 0);
  const [mode, setMode] = useState<Mode>("overall");
  const [sort, setSort] = useState("fdr");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const window = useMemo(() => gameweeks.filter(gw => gw >= start).slice(0, win), [gameweeks, start, win]);
  const byId = new Map(teams.map(t => [t.id, t]));
  const rows = teams.map(team => {
    const cells = window.map(gameweek => ({ gameweek, entries: fixturesForTeam(fixtures, team.id, gameweek).map(entry => {
      const opp = byId.get(entry.opponentId);
      const strength = mode === "attack" ? entry.home ? opp?.strengthDefenceAway : opp?.strengthDefenceHome
        : entry.home ? opp?.strengthAttackAway : opp?.strengthAttackHome;
      return { ...entry, opponent: opp?.shortName ?? "?", difficulty: mode === "overall" || strength == null ? entry.difficulty : strengthFdr(strength) };
    }) }));
    return { team, cells, run: fixtureRun(cells), owned: owned.includes(team.id) };
  }).filter(row => row.team.shortName.toLowerCase().includes(query.trim().toLowerCase())
    && (filter !== "owned" || row.owned) && (filter !== "blanks" || row.run.blanks > 0) && (filter !== "doubles" || row.run.doubles > 0));
  rows.sort((a, b) => sort === "name" ? a.team.shortName.localeCompare(b.team.shortName)
    : (a.run.average ?? Infinity) - (b.run.average ?? Infinity) || a.run.blanks - b.run.blanks || a.team.shortName.localeCompare(b.team.shortName));
  const ranked = rows.filter(r => r.run.average != null).sort((a, b) => a.run.average! - b.run.average!);
  const doubles = rows.filter(r => r.run.doubles > 0).length;
  if (!gameweeks.length) return <div className="card p-8 text-sm text-fg-muted">No future gameweeks are available. The next season&apos;s schedule will appear after ingestion.</div>;
  return <div className="space-y-5">
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="card p-5"><p className="section-label">Easiest scheduled run</p><p className="mt-3 text-xl font-medium">{ranked[0]?.team.shortName ?? "—"}<span className="ml-3 text-sm text-accent">{ranked[0]?.run.average?.toFixed(1)}</span></p></div>
      <div className="card p-5"><p className="section-label">Hardest scheduled run</p><p className="mt-3 text-xl font-medium">{ranked.at(-1)?.team.shortName ?? "—"}<span className="ml-3 text-sm text-fg-muted">{ranked.at(-1)?.run.average?.toFixed(1)}</span></p></div>
      <div className="card p-5"><p className="section-label">Clubs with a double</p><p className="mt-3 text-xl font-medium">{doubles}<span className="ml-3 text-xs text-fg-muted">in this window</span></p></div>
    </div>
    <div className="card flex flex-wrap items-end gap-3 p-4">
      <label className="text-[11px] text-fg-muted">Starting week<select aria-label="Fixture start gameweek" value={start} onChange={e => setStart(Number(e.target.value))} className="field-input mt-2">{gameweeks.map(gw => <option key={gw} value={gw}>GW{gw}</option>)}</select></label>
      <SegmentedControl size="sm" ariaLabel="Gameweek window" value={win} onChange={v => setWin(Number(v))} options={[3, 5, 8].map(n => ({ label: `Next ${n}`, value: n }))} />
      <SegmentedControl size="sm" ariaLabel="Difficulty type" value={mode} onChange={setMode} options={[{ label: "Overall", value: "overall" }, { label: "Attack", value: "attack" }, { label: "Defence", value: "defence" }]} />
      <label className="text-[11px] text-fg-muted">Show<select aria-label="Fixture club group" value={filter} onChange={e => setFilter(e.target.value)} className="field-input mt-2"><option value="all">All clubs</option><option value="owned">Squad clubs</option><option value="blanks">With blanks</option><option value="doubles">With doubles</option></select></label>
      <label className="text-[11px] text-fg-muted">Sort<select aria-label="Sort fixture clubs" value={sort} onChange={e => setSort(e.target.value)} className="field-input mt-2"><option value="fdr">Easiest average</option><option value="name">A–Z</option></select></label>
      <label className="min-w-32 flex-1 text-[11px] text-fg-muted">Club<input aria-label="Filter fixtures by club" placeholder="Find a club" value={query} onChange={e => setQuery(e.target.value)} className="field-input mt-2" /></label>
    </div>
    <div className="card overflow-x-auto"><table className="w-full text-center text-[11px]"><caption className="sr-only">Fixture difficulty by club and gameweek. Blanks and doubles are counted separately from average difficulty.</caption><thead><tr className="border-b border-border text-fg-muted"><th className="sticky left-0 z-10 bg-surface-1 p-4 text-left">Club</th>{window.map(gw => <th key={gw} className="min-w-24 p-3">GW{gw}</th>)}<th className="min-w-20 p-3">Matches</th><th className="min-w-24 p-3">Avg FDR</th></tr></thead><tbody>
      {rows.map(row => <tr key={row.team.id} className={`border-b border-border last:border-0 ${row.owned ? "bg-accent/5" : ""}`}><th scope="row" className="sticky left-0 z-10 bg-surface-1 p-4 text-left"><Link href={`/fixtures?team=${row.team.id}`} className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={CREST_URL(row.team.code)} alt="" className="h-5 w-5" />{row.team.shortName}{row.owned && <IconStar className="h-3 w-3 text-accent" />}</Link></th>
        {row.cells.map(cell => <td key={cell.gameweek} className="p-1.5">{cell.entries.length ? <div className="flex flex-col gap-1">{cell.entries.map((e, i) => <FDRCell key={i} opponent={e.opponent} wasHome={e.home} difficulty={e.difficulty} />)}{cell.entries.length > 1 && <span className="text-[8px] text-accent">DOUBLE</span>}</div> : <span className="text-[9px] text-fg-subtle" title="No fixture currently assigned">BLANK</span>}</td>)}
        <td className="p-3 tabular-nums">{row.run.fixtures}<span className="mt-1 block text-[8px] text-fg-subtle">{row.run.blanks ? `${row.run.blanks} blank` : "No blanks"}</span></td>
        <td className="p-3"><span className="rounded-lg px-2 py-1 text-xs font-medium" style={{ background: fdrColor(row.run.average == null ? null : Math.round(row.run.average)), color: "white" }}>{row.run.average?.toFixed(1) ?? "—"}</span>{row.run.unknown > 0 && <span className="mt-1 block text-[8px] text-fg-subtle">{row.run.unknown} unrated</span>}</td></tr>)}
      {!rows.length && <tr><td colSpan={window.length + 3} className="p-8 text-fg-muted">No clubs match these filters.</td></tr>}
    </tbody></table></div>
    <div className="flex flex-wrap gap-4 text-[10px] text-fg-muted">{["Very easy", "Easy", "Average", "Hard", "Very hard"].map((label, i) => <span key={label} className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: fdrColor(i + 1) }} />{label}</span>)}</div>
    <p className="text-[11px] leading-6 text-fg-muted">Average FDR is per rated match. Blanks add no invented difficulty and doubles count both fixtures. Overall uses FPL difficulty; Attack and Defence use opponent strength as a heuristic. Unassigned fixtures and dates can change.</p>
  </div>;
}
