"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";

export function CompareBar({
  selectedCodes,
  max,
  onClear,
}: {
  selectedCodes: number[];
  max: number;
  onClear: () => void;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {selectedCodes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6"
        >
          <div className="glass flex items-center gap-3 rounded-full border border-border-strong px-4 py-2.5 shadow-[var(--shadow-pop)]">
            <span className="text-xs font-semibold text-fg-muted">
              {selectedCodes.length} selected{" "}
              <span className="text-fg-subtle">(up to {max})</span>
            </span>
            <button
              onClick={onClear}
              className="text-xs font-semibold text-fg-subtle transition-colors hover:text-fg"
            >
              Clear
            </button>
            <button
              disabled={selectedCodes.length < 2}
              onClick={() => router.push(`/players/compare?codes=${selectedCodes.join(",")}`)}
              className="rounded-full px-4 py-1.5 text-xs font-bold text-white transition-all hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--brand-purple-bright))" }}
            >
              Compare →
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
