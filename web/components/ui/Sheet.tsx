"use client";
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const subscribe = () => () => {};
export function Sheet({ open, onClose, children, title }: { open: boolean; onClose: () => void; children: ReactNode; title?: string }) {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!open || !mounted) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key === "Tab") {
        const elements = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, [tabindex="0"]') ?? []);
        const first = elements[0];
        const last = elements.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, [open, mounted, onClose]);
  if (!mounted) return null;
  return createPortal(<AnimatePresence>{open && <div className="fixed inset-0 z-50"><motion.div className="absolute inset-0 bg-[#132821]/25 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .2 }} onClick={onClose} aria-hidden="true" /><motion.div ref={panelRef} tabIndex={-1} className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-surface-1 shadow-[var(--shadow-pop)] outline-none sm:inset-y-3 sm:right-3 sm:rounded-3xl sm:border" initial={{ opacity: 0, x: reduced ? 0 : 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: reduced ? 0 : 40 }} transition={{ duration: reduced ? 0 : .3, ease: [.22, 1, .36, 1] }} role="dialog" aria-modal="true" aria-labelledby={titleId}><div className="flex items-center justify-between border-b border-border px-6 py-5"><h2 id={titleId} className="text-sm font-semibold">{title ?? "Player details"}</h2><button className="icon-button" onClick={onClose} aria-label="Close player details"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg></button></div><div className="flex-1 overflow-y-auto p-6">{children}</div></motion.div></div>}</AnimatePresence>, document.body);
}
