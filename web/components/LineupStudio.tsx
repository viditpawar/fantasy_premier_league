"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { SquadPlayer } from "@/lib/types";
import { useLocalState } from "@/lib/local-state";
import { downloadText } from "@/lib/download";
import { formationOf, initialStudioLineup, lineupIssues, parseStudio, rehearseLineup, suggestLineup, swapLineup, type ResearchFixture, type StudioLineup, type StudioPlayer } from "@/lib/studio";
import { PlayerKit } from "./PlayerKit";
import { IconArrowRight, IconCheck, IconPitch, IconShield, IconSparkles } from "./icons";

export function LineupStudio({ players, savedSquad, fixtures, season, teamId, target, sourceGameweek }: {
  players: StudioPlayer[]; savedSquad: SquadPlayer[]; fixtures: ResearchFixture[]; season: string; teamId: number; target: number | null; sourceGameweek: number;
}) {
  const initial = useMemo(() => initialStudioLineup(savedSquad), [savedSquad]);
  const [saved, setSaved, temporary] = useLocalState<StudioLineup>(`fpl:lineup:${season}:${teamId}:${target ?? sourceGameweek}`, initial, value => parseStudio(value, initial));
  const stale = lineupIssues(players, saved).length > 0;
  const lineup = stale ? initial : saved;
  const [selected, setSelected] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"team" | "rehearsal">("team");
  const [minutes, setMinutes] = useState<Record<number, number>>({});
  const [chip, setChip] = useState("standard");
  const byCode = new Map(players.map(p => [p.code, p]));
  const result = rehearseLineup(players, lineup, minutes);
  const fielded = chip === "bench" ? players.filter(p => (minutes[p.code] ?? 90) > 0).map(p => p.code) : result.fielded;
  const substitutions = chip === "bench" ? [] : result.substitutions;
  const captain = result.captain == null ? null : byCode.get(result.captain);

  function choose(code: number) {
    if (lineup.starters.includes(code)) { setSelected(selected === code ? null : code); setNotice(""); return; }
    if (selected == null) { setNotice("Select a starting player first, then choose their replacement from your bench."); return; }
    const next = swapLineup(players, lineup, selected, code);
    if (!next) { setNotice("That swap breaks the formation. Keep one goalkeeper, at least three defenders and at least one forward."); return; }
    setSaved(next); setSelected(null); setNotice("Lineup draft saved. Review the updated captain and vice-captain.");
  }
  function moveBench(index: number, direction: number) {
    const next = [...lineup.bench];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setSaved({ ...lineup, bench: next });
  }
  function tile(code: number, benchIndex?: number) {
    const p = byCode.get(code);
    if (!p) return null;
    return <div key={code} className="studio-tile-wrap">
      <button className="studio-tile" data-selected={selected === code} onClick={() => choose(code)} aria-pressed={selected === code} aria-label={benchIndex == null ? `Select ${p.name} to swap` : `Bring ${p.name} into your XI`}>
        <span className="studio-shirt"><PlayerKit code={p.teamCode} goalkeeper={p.position === "GKP"} className="h-14 w-14" />{lineup.captain === code && <b className="armband">C</b>}{lineup.vice === code && <b className="armband vice">V</b>}{p.status !== "a" && <span className="player-flag" title="Check availability">!</span>}</span>
        <strong>{p.name}</strong><small>{p.team} <span>· {p.position}</span></small>
      </button>
      {benchIndex != null && benchIndex < 3 && <div className="bench-order-controls"><span>SUB {benchIndex + 1}</span><button disabled={benchIndex === 0} onClick={() => moveBench(benchIndex, -1)} aria-label={`Move ${p.name} earlier on bench`}>↑</button><button disabled={benchIndex === 2} onClick={() => moveBench(benchIndex, 1)} aria-label={`Move ${p.name} later on bench`}>↓</button></div>}
      {benchIndex === 3 && <span className="reserve-label">RESERVE GK</span>}
    </div>;
  }
  const risks = players.filter(p => p.status !== "a" || p.chance != null && p.chance < 100);
  const issues = lineupIssues(players, lineup);
  if (issues.length) return <section className="card workspace-panel"><h1 className="large-title">Your squad needs a refresh.</h1><p className="workspace-copy mt-4">The saved data cannot form a complete legal XI yet. Refresh ingestion before using the studio.</p><ul className="mt-4 space-y-2 text-sm text-warning">{issues.map(issue => <li key={issue}>{issue}</li>)}</ul><Link href="/squad" className="button-secondary mt-5">Review saved squad <IconArrowRight /></Link></section>;
  return <>
    <header className="workspace-intro"><div><p className="page-eyebrow">Every player has a part to play</p><h1 className="large-title">The lineup studio<span className="text-accent">.</span></h1><p className="page-description">Find your shape. Set the armbands. Make the bench count.</p></div><span className="edition-tag">{target ? `GW ${String(target).padStart(2, "0")} DRAFT` : "LINEUP DRAFT"}</span></header>
    <div className="workspace-toolbar"><div className="workspace-tabs" aria-label="Studio mode"><button aria-pressed={mode === "team"} onClick={() => setMode("team")}><IconPitch />Team sheet</button><button aria-pressed={mode === "rehearsal"} onClick={() => setMode("rehearsal")}><IconShield />Autosub rehearsal</button></div><div className="toolbar-actions"><button className="button-secondary" disabled={target == null} onClick={() => { const next = suggestLineup(players, fixtures, target!); if (next) { setSaved(next); setNotice("A legal XI suggested from observed points, season minutes, availability and fixtures. Review team news; this is a heuristic, not expected points."); setSelected(null); } else setNotice("There is not enough observed performance and fixture data to suggest an XI. You can still build your draft manually."); }}><IconSparkles />Suggest XI</button><button className="button-secondary" onClick={() => { setSaved(initial); setMinutes({}); setSelected(null); setNotice("Restored the saved FPL squad snapshot."); }}>Reset</button><button className="button-secondary" onClick={() => downloadText(`fpl-lineup-gw${target ?? sourceGameweek}.json`, JSON.stringify({ season, teamId, gameweek: target, sourceGameweek, lineup, minutes, chip, exportedAt: new Date().toISOString(), type: "local-lineup-draft" }, null, 2), "application/json")}>Export draft</button><button className="button-secondary print-action" onClick={() => window.print()}>Print team sheet</button></div></div>
    {(notice || temporary || stale) && <p className="workspace-notice" role="status">{stale ? "A previous draft no longer matches all 15 saved players. The latest squad has been loaded. " : ""}{temporary ? "Browser storage is unavailable; this draft lasts for this visit. " : ""}{notice}</p>}
    <div className="studio-layout"><section className="card studio-team-sheet"><div className="panel-heading"><div><span className="section-label">{season} · Your tactical board</span><h2 className="mt-2">{formationOf(players, lineup.starters)} <span className="font-normal text-fg-muted">formation</span></h2></div><span className="workspace-badge"><IconCheck />{players.length} players included</span></div>
      <p className="studio-instruction">{selected == null ? "Select a starter, then a bench player to make a formation-safe swap." : `${byCode.get(selected)?.name} selected. Choose a replacement from the bench.`}</p>
      <div className="studio-pitch"><div className="studio-pitch-lines" aria-hidden="true"><i /><span /><b /></div>{(["GKP", "DEF", "MID", "FWD"] as const).map(pos => <div className="studio-pitch-row" key={pos}>{lineup.starters.filter(id => byCode.get(id)?.position === pos).map(id => tile(id))}</div>)}</div>
      <div className="studio-bench"><div className="flex items-center justify-between"><span className="section-label">Your bench · order matters</span><span className="text-xs text-fg-muted">Outfield 1 → 3, then GK</span></div><div className="studio-bench-row">{lineup.bench.map((id, i) => tile(id, i))}</div></div>
    </section>
    <aside className="studio-aside">
      <section className="card workspace-panel"><span className="section-label">The armband decision</span><h2 className="mt-2 text-lg font-semibold">Choose your leaders</h2><div className="mt-5 grid gap-4">{(["captain", "vice"] as const).map(role => <label className="workspace-field" key={role}><span>{role === "captain" ? "Captain · 2× points" : "Vice-captain · your fallback"}</span><select value={lineup[role]} onChange={e => { const id = Number(e.target.value); const other = role === "captain" ? "vice" : "captain"; if (id === lineup[other]) { setNotice("Captain and vice-captain must be different starters."); return; } setSaved({ ...lineup, [role]: id }); }} className="field-input">{lineup.starters.map(id => <option value={id} key={id}>{byCode.get(id)?.name}</option>)}</select></label>)}</div></section>
      {mode === "rehearsal" ? <section className="card workspace-panel"><span className="section-label">What happens if…</span><h2 className="mt-2 text-lg font-semibold">Rehearse automatic subs</h2><p className="workspace-copy mt-2">Hypothetical full-gameweek minutes. Everyone is assumed to play 90 until you change them. A one-minute cameo prevents an autosub.</p><label className="workspace-field mt-4"><span>Scoring scenario</span><select className="field-input" value={chip} onChange={e => setChip(e.target.value)}><option value="standard">Standard gameweek</option><option value="bench">Bench Boost scenario</option><option value="triple">Triple Captain scenario</option></select></label><div className="simulation-inputs">{lineup.starters.map(id => <label key={id}><span>{byCode.get(id)?.name}</span><select value={minutes[id] ?? 90} onChange={e => setMinutes({ ...minutes, [id]: Number(e.target.value) })} aria-label={`${byCode.get(id)?.name} hypothetical minutes`}><option value={90}>90 min</option><option value={1}>1 min</option><option value={0}>0 min</option></select></label>)}</div><details className="simulation-reserves"><summary>Set bench minutes</summary><div className="simulation-inputs">{lineup.bench.map(id => <label key={id}><span>{byCode.get(id)?.name}</span><select value={minutes[id] ?? 90} onChange={e => setMinutes({ ...minutes, [id]: Number(e.target.value) })} aria-label={`${byCode.get(id)?.name} hypothetical minutes`}><option value={90}>90 min</option><option value={1}>1 min</option><option value={0}>0 min</option></select></label>)}</div></details><div className="simulation-result" aria-live="polite"><strong>{fielded.length}<small> players would score</small></strong>{substitutions.map(sub => <p key={sub.out}>{byCode.get(sub.out)?.name} <span>→</span> {byCode.get(sub.in)?.name}</p>)}{!substitutions.length && <p>{chip === "bench" ? "All playing squad members count. No autosubs are needed." : "No automatic substitutions in this scenario."}</p>}<p>{captain ? `${captain.name} receives the ${chip === "triple" ? "3×" : "2×"} captain multiplier.` : "Neither captain plays: no captain bonus."}</p></div></section> : <section className="card workspace-panel"><span className="section-label">The whole squad matters</span><h2 className="mt-2 text-lg font-semibold">Your selection check</h2><div className="studio-audit"><p><IconCheck />Legal {formationOf(players, lineup.starters)} formation</p><p><IconCheck />All 15 players accounted for</p><p><IconShield />{risks.length} current availability flag{risks.length === 1 ? "" : "s"}</p></div>{risks.map(p => <Link key={p.code} href={`/players/${p.code}`} className="tool-link"><span><strong>{p.name}</strong><small>{p.chance == null ? "Review team news" : `${p.chance}% playing-chance flag`}</small></span><IconArrowRight className="ml-auto h-4 w-4" /></Link>)}<button className="button-secondary mt-5 w-full" onClick={() => setMode("rehearsal")}>Test an absence <IconArrowRight /></button></section>}
      <p className="workspace-footnote">A local draft based on your locked GW{sourceGameweek} squad. It does not change your FPL account or verify transfers since that deadline. The suggestion index is not a forecast. Exported drafts are not advisor current-state files.</p>
    </aside></div>
  </>;
}
