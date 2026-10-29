const PREFIXES = ["fpl:watchlist:", "fpl:compare:", "fpl:lineup:", "fpl:prep:", "fpl:research:", "fpl:planner:", "fpl:plan:"];
export const isWorkspaceKey = (key: string) => PREFIXES.some(prefix => key.startsWith(prefix));
export interface WorkspaceBackup { type: "fpl-cockpit-workspace"; version: 1; createdAt: string; entries: [string, string][] }
export function parseBackup(text: string): WorkspaceBackup {
  if (text.length > 2_000_000) throw new Error("Choose a workspace backup smaller than 2 MB.");
  const data = JSON.parse(text) as WorkspaceBackup;
  if (!data || data.type !== "fpl-cockpit-workspace" || data.version !== 1 || !Number.isFinite(Date.parse(data.createdAt)) || !Array.isArray(data.entries) || data.entries.length > 200) throw new Error("Choose a valid FPL Cockpit workspace backup.");
  const seen = new Set<string>();
  for (const entry of data.entries) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" || typeof entry[1] !== "string" || !isWorkspaceKey(entry[0]) || entry[0].length > 250 || seen.has(entry[0])) throw new Error("This backup contains unsupported or repeated storage entries.");
    JSON.parse(entry[1]);
    seen.add(entry[0]);
  }
  return { type: "fpl-cockpit-workspace", version: 1, createdAt: data.createdAt, entries: data.entries };
}
