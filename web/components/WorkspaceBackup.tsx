"use client";
import { useState } from "react";
import { isWorkspaceKey, parseBackup, type WorkspaceBackup as Backup } from "@/lib/backup";
import { downloadText } from "@/lib/download";
import { IconDownload } from "./icons";

export function WorkspaceBackup() {
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState<Backup | null>(null);
  function exportBackup() {
    try {
      const entries: [string, string][] = [];
      for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key && isWorkspaceKey(key)) entries.push([key, localStorage.getItem(key)!]); }
      const backup: Backup = { type: "fpl-cockpit-workspace", version: 1, createdAt: new Date().toISOString(), entries };
      const serialized = JSON.stringify(backup, null, 2);
      parseBackup(serialized);
      downloadText("fpl-cockpit-workspace.json", serialized, "application/json");
      setStatus(`Exported ${entries.length} saved workspace items.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Browser storage is unavailable. This workspace could not be exported."); }
  }
  function restore() {
    if (!pending) return;
    const before = new Map<string, string | null>();
    try {
      for (const [key] of pending.entries) before.set(key, localStorage.getItem(key));
      for (const [key, value] of pending.entries) localStorage.setItem(key, value);
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
      window.dispatchEvent(new Event("fpl:local-state"));
      setStatus(`Restored ${pending.entries.length} workspace items. Other saved items were kept.`); setPending(null);
    } catch {
      for (const [key, value] of before) { try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* storage may remain unavailable */ } }
      setStatus("The backup could not be restored. Check available browser storage.");
    }
  }
  return <section className="card workspace-panel"><span className="section-label">Your work, ready to travel</span><h2 className="mt-2 text-lg font-semibold">Back up your workspace</h2><p className="workspace-copy mt-3">Export watchlists, comparison picks, transfer plans, lineup drafts, research views, preparation checks and notes. Restore them in another browser. Entries keep their original season and manager.</p><div className="mt-5 flex flex-wrap items-center gap-3"><button className="button-secondary" onClick={exportBackup}><IconDownload />Export workspace</button><label className="button-secondary cursor-pointer">Choose backup<input className="sr-only" type="file" accept="application/json,.json" onChange={async event => { const file = event.target.files?.[0]; setPending(null); if (!file) return; try { if (file.size > 2_000_000) throw new Error("Choose a workspace backup smaller than 2 MB."); const backup = parseBackup(await file.text()); setPending(backup); setStatus(`${backup.entries.length} items ready to restore. Matching drafts will be replaced.`); } catch (error) { setStatus(error instanceof Error ? error.message : "Choose a valid workspace backup."); } event.target.value = ""; }} /></label></div>{pending && <div className="mt-4 flex flex-wrap gap-3"><button className="button-primary" onClick={restore}>Restore {pending.entries.length} items</button><button className="button-secondary" onClick={() => { setPending(null); setStatus("Import cancelled."); }}>Cancel</button></div>}{status && <p role="status" className="workspace-notice !mb-0">{status}</p>}<p className="workspace-footnote mt-4">Files are processed in this browser. The export contains your planning data, so keep it somewhere you trust. It contains no FPL login or database credentials.</p></section>;
}
