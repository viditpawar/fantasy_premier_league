"use client";
import Link from "next/link";
import { useLocalState } from "@/lib/local-state";
import { PREP_TASKS, parsePrep } from "@/lib/studio";
import { IconArrowRight, IconCheck } from "./icons";

export function GameweekPrep({ season, teamId, gameweek, compact = false }: { season: string; teamId: number; gameweek: number | null; compact?: boolean }) {
  const [prep, setPrep, temporary] = useLocalState(`fpl:prep:${season}:${teamId}:${gameweek ?? "offseason"}`, { checked: [], notes: "" }, parsePrep);
  const count = prep.checked.length;
  return <section className={`card prep-card ${compact ? "prep-compact" : ""}`}>
    <div className="panel-heading"><div><span className="section-label">The deadline desk</span><h2 className="mt-2">A little preparation. A better gameweek.</h2></div><span className="prep-fraction">{count}<small>/{PREP_TASKS.length}</small></span></div>
    <div className="prep-progress" aria-label={`${count} of ${PREP_TASKS.length} preparation tasks complete`}><span style={{ width: `${count / PREP_TASKS.length * 100}%` }} /></div>
    <div className="prep-tasks">{PREP_TASKS.map(task => <label key={task.id} className="prep-task" data-checked={prep.checked.includes(task.id)}>
      <input type="checkbox" checked={prep.checked.includes(task.id)} onChange={() => setPrep({ ...prep, checked: prep.checked.includes(task.id) ? prep.checked.filter(id => id !== task.id) : [...prep.checked, task.id] })} />
      <span className="prep-check" aria-hidden="true"><IconCheck /></span><span><strong>{task.label}</strong>{!compact && <small>{task.hint}</small>}</span>
    </label>)}</div>
    {!compact && <div className="prep-notes"><label htmlFor="gameweek-notes">Your gameweek notebook <span>Saved on this device</span></label><textarea id="gameweek-notes" rows={6} maxLength={4000} placeholder="The transfer you're considering. A player to keep an eye on. A reason to be patient…" value={prep.notes} onChange={event => setPrep({ ...prep, notes: event.target.value })} /><p>{prep.notes.length.toLocaleString()} / 4,000 characters · These checks do not confirm changes in your FPL account.</p></div>}
    {temporary && <p role="status" className="mx-6 mb-4 text-xs text-warning">Browser storage is unavailable. Changes last for this visit.</p>}
    {compact && <Link href="/gameweek" className="prep-footer">Open your gameweek HQ <IconArrowRight /></Link>}
  </section>;
}
