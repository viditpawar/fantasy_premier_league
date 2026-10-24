import { cache } from "react";
import { getWorkspace } from "@/lib/workspace";

const loadRefresh = cache(async () => {
  try {
    const { sb, season } = await getWorkspace();
    const { data, error } = await sb.from("data_refresh_status").select("completed_at").eq("season", season).maybeSingle();
    if (error || !data?.completed_at || !Number.isFinite(Date.parse(data.completed_at))) return null;
    const age = Date.now() - Date.parse(data.completed_at);
    return { completed: data.completed_at as string, stale: age > 4 * 60 * 60 * 1000 || age < -5 * 60 * 1000 };
  } catch { return null; }
});

export async function DataFreshness({ compact = false }: { compact?: boolean }) {
  const status = await loadRefresh();
  const completed = status?.completed ?? null;
  const stale = status?.stale ?? false;
  const time = completed ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Phoenix" }).format(new Date(completed)) : null;
  if (compact) return <span className={stale ? "text-warning" : "text-fg-subtle"} title={time ? `Last successful data refresh: ${time} MST` : "No successful refresh timestamp is available yet."}>{time ? `Data updated ${time} MST${stale ? " · May be out of date" : ""}` : "Refresh time unavailable"}</span>;
  return <section className="card p-6"><h2 className="text-sm font-semibold">Know how recent your data is.</h2><p className={`mt-4 text-sm ${stale ? "text-warning" : "text-accent"}`}>{time ? <time dateTime={completed!}>{time} MST</time> : "Update time unavailable"}</p><p className="mt-3 text-[12px] leading-6 text-fg-muted">{stale ? "The last successful update is more than four hours old. Check official FPL before using scores, prices or availability." : time ? "This is the last successful warehouse refresh. A page reload reads that saved snapshot." : "A refresh timestamp will appear after the next successful pipeline run. Page reloads do not fetch new FPL data."} The normal ingest schedule runs every two hours.</p></section>;
}
