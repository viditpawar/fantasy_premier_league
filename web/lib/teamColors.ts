export const TEAM_COLORS: Record<string, string> = {
  ARS: "#EF0107", AVL: "#670E36", BOU: "#DA291C", BRE: "#e30613",
  BHA: "#0057B8", BUR: "#6C1D45", CHE: "#034694", CRY: "#1B458F",
  EVE: "#003399", FUL: "#000000", LIV: "#C8102E", MCI: "#6CABDD",
  MUN: "#DA291C", NEW: "#241F20", NFO: "#DD0000", SUN: "#EB172B",
  TOT: "#132257", WHU: "#7A263A", WOL: "#FDB913", LEE: "#FFCD00",
  COV: "#78D0F7",
};

export const DEFAULT_TEAM_COLOR = "#6b7280";

export function teamColor(shortName: string): string {
  return TEAM_COLORS[shortName] ?? DEFAULT_TEAM_COLOR;
}
