"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PlayerSeasonRow, SquadPlayer } from "@/lib/types";
import type { TickerFixture, TickerTeam } from "@/lib/queries";
import { fixturesForTeam, parseMillions, simulatePlan, squadErrors, type PlanPick, type PlanWeek } from "@/lib/planning";
import { useLocalState, useWatchlist } from "@/lib/local-state";
import { money } from "@/lib/format";
import { Hero } from "./ui/Hero";
import { FDRCell } from "./ui/FDRCell";
import { IconSwap } from "./icons";

interface Draft { version: 1; picks: PlanPick[]; bank: string; allocation: string; made: string; weeks: PlanWeek[]; confirmedAt: string | null; signature: string }
function parseDraft(value: unknown, initial: Draft): Draft {
  if (!value || typeof value !== "object") return initial;
  const v = value as Draft;
  if (v.version !== 1 || !Array.isArray(v.picks) || v.picks.length !== 15 || !v.picks.every(p => p && Number.isInteger(p.code) && Number.isInteger(p.slot) && (p.sellingPrice === null || Number.isInteger(p.sellingPrice)))
      || ![v.bank, v.allocation, v.made, v.signature].every(s => typeof s === "string")
      || !(v.confirmedAt === null || typeof v.confirmedAt === "string")
      || !Array.isArray(v.weeks) || v.weeks.length < 1 || v.weeks.length > 5
      || !v.weeks.every((w, i) => w && w.gameweek <= 38 && w.gameweek === initial.weeks[0].gameweek + i && Array.isArray(w.moves) && w.moves.length <= 15 && w.moves.every(m => m && Number.isInteger(m.out) && Number.isInteger(m.in)))) return initial;
  return v;
}
function count(value: string, maximum: number) { return /^\d+$/.test(value) && Number(value) <= maximum ? Number(value) : null; }
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TransferPlanner({ season, teamId, sourceGameweek, target, savedSquad, savedBank, players, fixtures, teams }: {
  season: string; teamId: number; sourceGameweek: number; target: number; savedSquad: SquadPlayer[]; savedBank: number;
  players: PlayerSeasonRow[]; fixtures: TickerFixture[]; teams: TickerTeam[];
}) {
  const initial: Draft = { version: 1, picks: savedSquad.map(p => ({ code: p.playerCode, slot: p.squadPosition, sellingPrice: null })), bank: "", allocation: "", made: "", confirmedAt: null, signature: "",
    weeks: Array.from({ length: Math.min(3, 39 - target) }, (_, i) => ({ gameweek: target + i, moves: [] })) };
  const [draft, store, temporary] = useLocalState(`fpl:plan:${season}:${teamId}:${target}`, initial, value => parseDraft(value, initial));
  const [watchlist] = useWatchlist(season);
  const [query, setQuery] = useState("");
  const [shortlistOnly, setShortlistOnly] = useState(false);
  const [message, setMessage] = useState("");
  const [clock, setClock] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setClock(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const byCode = useMemo(() => new Map(players.map(p => [p.playerCode, p])), [players]);
  const byTeam = new Map(teams.map(t => [t.id, t.shortName]));
  const bank = parseMillions(draft.bank);
  const allocation = count(draft.allocation, 5), made = count(draft.made, 20);
  const remaining = allocation == null || made == null ? null : Math.max(0, allocation - made);
  const committed = allocation == null || made == null ? null : Math.max(0, made - allocation) * 4;
  const signature = JSON.stringify(draft.picks.map(p => { const data = byCode.get(p.code); return [p.code, data?.nowCost, data?.teamId, data?.position, data?.status]; }));
  const age = draft.confirmedAt == null ? Infinity : clock - Date.parse(draft.confirmedAt);
  const confirmed = Number.isFinite(age) && age >= 0 && age <= 24 * 60 * 60 * 1000 && draft.signature === signature;
  const baselineErrors = squadErrors(draft.picks, byCode, false);
  const results = simulatePlan(draft.picks, players, bank, remaining, draft.weeks);
  const totalHits = confirmed && results.every(r => !r.errors.length) ? results.reduce((n, r) => n + r.hitCost, 0) : null;
  const update = useCallback((next: Draft, baseline = false) => { setClock(Date.now()); store(baseline ? { ...next, confirmedAt: null, signature: "" } : next); setMessage(""); }, [store]);
  function updatePick(index: number, changes: Partial<PlanPick>) { update({ ...draft, picks: draft.picks.map((p, i) => i === index ? { ...p, ...changes } : p) }, true); }
  function updateMoves(index: number, moves: PlanWeek["moves"]) { update({ ...draft, weeks: draft.weeks.map((w, i) => i === index ? { ...w, moves } : w) }); }
  const exportReady = confirmed && !baselineErrors.length && bank != null && allocation != null && made != null && draft.picks.every(p => p.sellingPrice != null);
  const exportSnapshot = useCallback(() => {
    if (!exportReady) return;
    if (Date.now() - Date.parse(draft.confirmedAt!) > 24 * 60 * 60 * 1000) { setClock(Date.now()); setMessage("Confirm a fresh baseline before exporting."); return; }
    download("current-state.json", { team_id: teamId, season, for_gameweek: target, captured_at: draft.confirmedAt,
      picks: draft.picks.map(p => ({ element: byCode.get(p.code)!.playerId, position: p.slot, selling_price: p.sellingPrice })), transfers: { bank: parseMillions(draft.bank), limit: count(draft.allocation, 5), made: count(draft.made, 20) } });
    setMessage("Current squad exported for the manual advisor. The export contains your baseline, before any hypothetical transfers.");
  }, [exportReady, draft, teamId, season, target, byCode]);
  return <div>
    <Hero title="Make room for your next move." eyebrow={`Transfer planner · GW${target} onward`} icon={<IconSwap />} subtitle="Explore a few gameweeks before committing. Build a draft, check the costs, keep your options open." stats={[{ label: "Free transfers remaining", value: confirmed ? remaining ?? "Unconfirmed" : "Unconfirmed", accent: true }, { label: "Draft transfer hits", value: totalHits == null ? "Check setup" : totalHits ? `−${totalHits} pts` : "None" }, { label: "Already committed hits", value: confirmed && committed != null ? `${committed} pts` : "Unconfirmed" }]} />
    <div className="mb-6 rounded-2xl border border-accent/15 bg-accent/5 p-5 text-[12px] leading-6 text-fg-muted">Start with your saved GW{sourceGameweek} squad. Update it to match My Team, including any transfers already made. This planner uses today&apos;s prices, ordinary transfers and a maximum bank of five free transfers. Chips and future price changes need a separate check.</div>
    <details className="card mb-6 p-5" open={!confirmed}><summary className="cursor-pointer text-sm font-medium">1. Confirm your current squad and funds <span className="ml-2 text-[10px] text-accent">{confirmed ? "Confirmed on this device" : "Setup required"}</span></summary>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <label className="text-[11px] text-fg-muted">Current bank (£m)<input className="field-input mt-2" aria-label="Current bank" type="number" min="0" max="200" step="0.1" placeholder={`Saved GW${sourceGameweek}: ${(savedBank / 10).toFixed(1)}`} value={draft.bank} onChange={e => update({ ...draft, bank: e.target.value }, true)} /></label>
        <label className="text-[11px] text-fg-muted">Free transfer allocation before this week&apos;s moves<select className="field-input mt-2" aria-label="Free transfer allocation" value={draft.allocation} onChange={e => update({ ...draft, allocation: e.target.value }, true)}><option value="">Confirm allocation</option>{[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
        <label className="text-[11px] text-fg-muted">Transfers already made this week<input className="field-input mt-2" aria-label="Transfers already made" type="number" min="0" max="20" step="1" placeholder="Confirm count" value={draft.made} onChange={e => update({ ...draft, made: e.target.value }, true)} /></label>
      </div>
      <p className="my-4 text-[11px] leading-6 text-fg-muted">Enter actual selling values from FPL, not market prices. Values are in £m: 5.2 means £5.2m. A sale price is needed for each outgoing player; all fifteen are needed to export a current-squad file. Use lineup slots to swap starters and substitutes.</p>
      <details className="mt-4"><summary className="cursor-pointer text-[12px] font-medium">Review squad and selling prices (15 players)</summary><div className="mt-4 grid gap-3 lg:grid-cols-2">{draft.picks.map((pick, index) => { const player = byCode.get(pick.code); return <div key={index} className="grid grid-cols-[minmax(0,1fr)_5rem_4rem] items-end gap-2 rounded-xl border border-border p-3">
        <label className="min-w-0 text-[10px] text-fg-muted">{pick.slot <= 11 ? "Starting" : "Bench"} · {player?.position ?? "Unknown"}<select className="field-input mt-1.5" aria-label={`Squad player slot ${pick.slot}`} value={pick.code} onChange={e => updatePick(index, { code: Number(e.target.value), sellingPrice: null })}>{players.filter(p => p.position === player?.position).sort((a, b) => a.player.localeCompare(b.player)).map(p => <option value={p.playerCode} key={p.playerCode}>{p.player} · {p.team}</option>)}</select></label>
        <label className="text-[10px] text-fg-muted">Sell £m<input className="field-input mt-1.5" aria-label={`Selling price slot ${pick.slot}`} type="number" min="0.1" max="200" step="0.1" placeholder="Actual" key={`${pick.code}-${pick.sellingPrice}`} defaultValue={pick.sellingPrice == null ? "" : (pick.sellingPrice / 10).toFixed(1)} onBlur={e => updatePick(index, { sellingPrice: parseMillions(e.target.value) })} /></label>
        <label className="text-[10px] text-fg-muted">Slot<select className="field-input mt-1.5" aria-label={`Lineup slot for ${player?.player ?? index}`} value={pick.slot} onChange={e => { const slot = Number(e.target.value); update({ ...draft, picks: draft.picks.map((p, i) => i === index ? { ...p, slot } : p.slot === slot ? { ...p, slot: pick.slot } : p) }, true); }}>{Array.from({ length: 15 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}</select></label>
      </div>; })}</div></details>
      {baselineErrors.length > 0 && <ul className="mt-4 space-y-1 text-xs text-warning">{baselineErrors.map(e => <li key={e}>{e}</li>)}</ul>}
      <label className="mt-5 flex items-start gap-3 text-[12px] leading-6"><input className="mt-1.5 accent-[var(--accent)]" type="checkbox" aria-label="Confirm current squad" checked={confirmed} disabled={baselineErrors.length > 0 || bank == null || remaining == null} onChange={e => update({ ...draft, confirmedAt: e.target.checked ? new Date().toISOString() : null, signature: e.target.checked ? signature : "" })} /><span>I checked this squad, bank and transfer counts against My Team. I will confirm selling values before using a planned move.</span></label>
    </details>
    <section className="mb-6 flex flex-wrap items-end gap-4 rounded-2xl border border-border p-5">
      <label className="text-[11px] text-fg-muted">Planning window<select className="field-input mt-2" aria-label="Transfer planning window" value={draft.weeks.length} onChange={e => update({ ...draft, weeks: Array.from({ length: Number(e.target.value) }, (_, i) => draft.weeks[i] ?? { gameweek: target + i, moves: [] }) })}>{Array.from({ length: Math.min(5, 39 - target) }, (_, i) => <option key={i} value={i + 1}>{i + 1} gameweek{i ? "s" : ""}</option>)}</select></label>
      <label className="min-w-36 flex-1 text-[11px] text-fg-muted">Find an incoming player<input className="field-input mt-2" aria-label="Search transfer candidates" placeholder="Search name or club" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <button className="button-secondary" aria-pressed={shortlistOnly} onClick={() => setShortlistOnly(!shortlistOnly)}>{shortlistOnly ? "Watchlist only" : "All candidates"}</button>
      <button className="button-secondary" onClick={() => update({ ...draft, weeks: draft.weeks.map(w => ({ ...w, moves: [] })) })}>Clear planned moves</button>
    </section>
    <div className="space-y-5">{draft.weeks.map((week, index) => {
      const result = results[index];
      const beforeSquad = index === 0 ? draft.picks : results[index - 1].squad;
      const ready = confirmed && !result.errors.length;
      return <section key={week.gameweek} className="card p-5 sm:p-6" aria-label={`Plan gameweek ${week.gameweek}`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="section-label">{index === 0 ? "Your next deadline" : "Looking ahead"}</p><h2 className="mt-2 text-xl font-medium">Gameweek {week.gameweek}</h2></div><button className="button-secondary" disabled={week.moves.length >= 15} onClick={() => updateMoves(index, [...week.moves, { out: beforeSquad[0]?.code ?? 0, in: 0 }])}>+ Add transfer</button></div>
        <div className="my-5 grid grid-cols-3 gap-3 border-y border-border py-4 text-[11px]"><div><span className="text-fg-muted">Bank after moves</span><strong className="mt-2 block text-lg font-medium">{ready ? money(result.bank) : "—"}</strong></div><div><span className="text-fg-muted">Free left this week</span><strong className="mt-2 block text-lg font-medium">{ready ? result.freeAfter : "—"}</strong></div><div><span className="text-fg-muted">New hit cost</span><strong className={`mt-2 block text-lg font-medium ${result.hitCost && ready ? "text-warning" : "text-accent"}`}>{ready ? result.hitCost ? `−${result.hitCost}` : "0" : "—"}</strong></div></div>
        {!week.moves.length && <p className="mb-4 text-[12px] leading-6 text-fg-muted">Roll the transfer, or explore a change. Unused free transfers carry into the following week, capped at five.</p>}
        <div className="space-y-4">{week.moves.map((move, moveIndex) => {
          const outgoing = byCode.get(move.out), incoming = byCode.get(move.in);
          const options = players.filter(p => p.position === outgoing?.position && !beforeSquad.some(s => s.code === p.playerCode) && (!shortlistOnly || watchlist.includes(p.playerCode)) && `${p.player} ${p.team}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => b.totalPoints - a.totalPoints);
          const change = (next: typeof move) => updateMoves(index, week.moves.map((m, i) => i === moveIndex ? next : m));
          return <div key={moveIndex} className="rounded-xl border border-border bg-surface-0/50 p-4"><div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className="min-w-0 text-[10px] text-fg-muted">Transfer out<select className="field-input mt-2" aria-label={`Outgoing player GW${week.gameweek} move ${moveIndex + 1}`} value={move.out} onChange={e => change({ out: Number(e.target.value), in: 0 })}>{beforeSquad.map(p => <option key={p.slot} value={p.code}>{byCode.get(p.code)?.player ?? "Unknown"} · {byCode.get(p.code)?.position}</option>)}</select></label>
            <label className="min-w-0 text-[10px] text-fg-muted">Bring in<select className="field-input mt-2" aria-label={`Incoming player GW${week.gameweek} move ${moveIndex + 1}`} value={move.in} onChange={e => change({ ...move, in: Number(e.target.value) })}><option value="0">Choose a {outgoing?.position ?? "player"}</option>{incoming && !options.some(p => p.playerCode === incoming.playerCode) && <option value={incoming.playerCode}>{incoming.player} · {money(incoming.nowCost)}</option>}{options.map(p => <option key={p.playerCode} value={p.playerCode}>{p.player} · {p.team} · {money(p.nowCost)}{p.status !== "a" ? " · Check fitness" : ""}</option>)}</select></label>
            <button className="button-secondary" aria-label={`Remove transfer ${moveIndex + 1} from GW${week.gameweek}`} onClick={() => updateMoves(index, week.moves.filter((_, i) => i !== moveIndex))}>Remove</button>
          </div>{incoming && <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-fg-muted"><span>GW{week.gameweek} fixtures:</span>{fixturesForTeam(fixtures, incoming.teamId, week.gameweek).map((f, i) => <FDRCell key={i} opponent={byTeam.get(f.opponentId) ?? "?"} wasHome={f.home} difficulty={f.difficulty} size="sm" />)}{!fixturesForTeam(fixtures, incoming.teamId, week.gameweek).length && <span className="text-warning">No match scheduled</span>}</div>}</div>;
        })}</div>
        {(result.errors.length > 0 || !confirmed) && <ul className="mt-4 space-y-1 text-[11px] leading-6 text-warning">{!confirmed && index === 0 && <li>Confirm your current squad and funds above before using these totals.</li>}{result.errors.map(e => <li key={e}>{e}</li>)}</ul>}
        {result.warnings.map(w => <p key={w} className="mt-3 text-[11px] text-warning">{w}</p>)}
        {ready && <details className="mt-5 border-t border-border pt-4"><summary className="cursor-pointer text-[11px] text-fg-muted">Review this week&apos;s planned squad</summary><div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">{result.squad.slice().sort((a, b) => a.slot - b.slot).map(p => <Link href={`/players/${p.code}`} key={p.slot} className="rounded-lg bg-surface-0 px-3 py-2"><span className="mr-2 text-fg-subtle">{p.slot}</span>{byCode.get(p.code)?.player}</Link>)}</div></details>}
      </section>;
    })}</div>
    <section className="mt-6 rounded-2xl border border-border p-5"><h2 className="text-sm font-medium">Keep your draft close.</h2><p className="mt-3 text-[12px] leading-6 text-fg-muted">{temporary ? "Device storage is unavailable; this draft lasts for this visit." : "Your draft saves automatically on this device for this manager and target gameweek."} Export the plan as a backup, or export your confirmed baseline squad for the existing manual advisor workflow. Hypothetical moves are never sent to FPL.</p><div className="mt-4 flex flex-wrap gap-3"><button className="button-secondary" onClick={() => download(`fpl-plan-${season}-gw${target}.json`, { season, teamId, sourceGameweek, ...draft })}>Export draft</button><button className="button-secondary" disabled={!exportReady} onClick={exportSnapshot}>Export current squad</button><a href="https://fantasy.premierleague.com/transfers" target="_blank" rel="noreferrer" className="text-link">Review on FPL ↗</a></div>{!exportReady && <p className="mt-3 text-[10px] text-fg-muted">Current-squad export needs a confirmed setup and all fifteen actual selling values.</p>}<p role="status" className="mt-3 text-[11px] text-accent">{message}</p></section>
    <p className="mt-5 text-[11px] leading-6 text-fg-muted">Future costs are scenarios at current prices. Hits are arithmetic costs, not a recommendation to spend points. This plan excludes Wildcard, Free Hit, seasonal transfer top-ups and future player price changes.</p>
  </div>;
}
