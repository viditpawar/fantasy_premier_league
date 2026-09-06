"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { NAV_LINKS } from "../navLinks";

export interface CommandItem {
  id: string;
  label: string;
  sub?: string;
  href: string;
  group: string;
}

const OPEN_EVENT = "fpl:open-command-palette";

export function CommandPaletteTrigger() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className="flex h-8 items-center gap-2 rounded-lg border border-border px-2.5 text-xs font-medium text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
      aria-label="Open command palette"
    >
      <span>Search</span>
      <kbd className="hidden rounded border border-border bg-surface-2 px-1 text-[10px] sm:inline">⌘K</kbd>
    </button>
  );
}

export function CommandPalette({ items }: { items: CommandItem[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <AnimatePresence>
      {open && <PaletteBody items={items} onClose={() => setOpen(false)} />}
    </AnimatePresence>
  );
}

function PaletteBody({ items, onClose }: { items: CommandItem[]; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const allItems = useMemo<CommandItem[]>(
    () => [
      ...NAV_LINKS.map((l) => ({ id: `page:${l.href}`, label: l.label, href: l.href, group: "Pages" })),
      ...items,
    ],
    [items],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allItems.slice(0, 8);
    return allItems.filter((i) => `${i.label} ${i.sub ?? ""}`.toLowerCase().includes(q)).slice(0, 20);
  }, [query, allItems]);

  const clampedActive = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function choose(item: CommandItem | undefined) {
    if (!item) return;
    onClose();
    router.push(item.href);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]">
      <motion.div
        className="absolute inset-0 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        onClick={onClose}
      />
      <motion.div
        className="glass relative w-full max-w-lg overflow-hidden rounded-2xl border border-border-strong shadow-[var(--shadow-pop)]"
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.16 }}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              choose(results[clampedActive]);
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
          placeholder="Jump to a page, player, or team…"
          className="w-full border-b border-border bg-transparent px-4 py-3.5 text-sm text-fg outline-none placeholder:text-fg-subtle"
        />
        <ul className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-fg-muted">No matches</li>
          )}
          {results.map((item, i) => (
            <li key={item.id}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(item)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                  i === clampedActive ? "bg-surface-2 text-fg" : "text-fg-muted"
                }`}
              >
                <span className="truncate">
                  <span className="font-semibold text-fg">{item.label}</span>
                  {item.sub && <span className="ml-2 text-xs text-fg-subtle">{item.sub}</span>}
                </span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-fg-subtle">
                  {item.group}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
