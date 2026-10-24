"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "fpl:local-state";
const memory = new Map<string, string>();

function subscribe(callback: () => void) {
  const external = (event: StorageEvent) => { if (event.key == null) memory.clear(); else memory.delete(event.key); callback(); };
  window.addEventListener("storage", external);
  window.addEventListener(EVENT, callback);
  return () => { window.removeEventListener("storage", external); window.removeEventListener(EVENT, callback); };
}

export function useLocalState<T>(key: string, initial: T, parse: (value: unknown) => T) {
  const raw = useSyncExternalStore(subscribe, () => {
    try { return memory.get(key) ?? window.localStorage.getItem(key); }
    catch { return memory.get(key) ?? null; }
  }, () => null);
  let value = initial;
  if (raw != null) { try { value = parse(JSON.parse(raw)); } catch { /* ignore corrupt local data */ } }
  const setValue = useCallback((next: T) => {
    const serialized = JSON.stringify(next);
    try { window.localStorage.setItem(key, serialized); memory.delete(key); } catch { memory.set(key, serialized); }
    window.dispatchEvent(new Event(EVENT));
  }, [key]);
  return [value, setValue, memory.has(key)] as const;
}

export function parseWatchlist(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((n): n is number => Number.isSafeInteger(n) && n > 0))].slice(0, 200);
}

export function useWatchlist(season: string) {
  return useLocalState(`fpl:watchlist:${season}`, [] as number[], parseWatchlist);
}
