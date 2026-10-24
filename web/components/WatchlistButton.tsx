"use client";

import { useWatchlist } from "@/lib/local-state";
import { IconStar } from "./icons";

export function WatchlistButton({ code, name, season, compact = false }: { code: number; name: string; season: string; compact?: boolean }) {
  const [codes, setCodes, temporary] = useWatchlist(season);
  const saved = codes.includes(code);
  const full = !saved && codes.length >= 200;
  return <button type="button" disabled={full} aria-pressed={saved} aria-label={`${saved ? "Remove" : "Save"} ${name} ${saved ? "from" : "to"} watchlist`}
    onClick={event => { event.stopPropagation(); setCodes(saved ? codes.filter(n => n !== code) : [...codes, code]); }}
    title={full ? "Watchlist full. Remove a player to save another." : temporary ? "Storage unavailable; changes last for this visit." : saved ? "Remove from watchlist" : "Save to watchlist"}
    className={`${compact ? "grid h-8 w-8 place-items-center rounded-lg" : "button-secondary"} ${saved ? "!text-accent !border-accent/30" : "text-fg-muted"}`}>
    <IconStar className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />{!compact && (saved ? "Saved to watchlist" : "Save player")}
  </button>;
}
