import type { ChipAdvice, ChipRecommendation } from "@/lib/types";
import { IconBolt, IconStar, IconSwap, IconTrendingUp } from "./icons";
import type { ReactNode } from "react";

const CHIPS: { key: keyof ChipAdvice; label: string; icon: ReactNode }[] = [
  { key: "wildcard", label: "Wildcard", icon: <IconSwap className="h-4 w-4" /> },
  { key: "freeHit", label: "Free Hit", icon: <IconBolt className="h-4 w-4" /> },
  { key: "benchBoost", label: "Bench Boost", icon: <IconTrendingUp className="h-4 w-4" /> },
  { key: "tripleCaptain", label: "Triple Captain", icon: <IconStar className="h-4 w-4" /> },
];

function ChipTile({ label, icon, chip }: { label: string; icon: ReactNode; chip: ChipRecommendation }) {
  return (
    <div
      className={`card card-hover flex flex-col gap-2 px-3.5 py-3.5 ${
        chip.recommended ? "ring-1 ring-accent" : ""
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: chip.recommended
              ? "color-mix(in oklab, var(--accent) 18%, transparent)"
              : "var(--surface-2)",
            color: chip.recommended ? "var(--accent)" : "var(--fg-subtle)",
          }}
        >
          {icon}
        </span>
        <span className="text-sm font-bold text-fg">{label}</span>
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
          style={{
            background: chip.recommended
              ? "color-mix(in oklab, var(--accent) 18%, transparent)"
              : "var(--surface-2)",
            color: chip.recommended ? "var(--accent)" : "var(--fg-subtle)",
          }}
        >
          {chip.recommended ? "Consider it" : "Hold"}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-fg-muted">{chip.reason}</p>
    </div>
  );
}

export function ChipStrategy({ advice }: { advice: ChipAdvice }) {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {CHIPS.map(({ key, label, icon }) => (
        <ChipTile key={key} label={label} icon={icon} chip={advice[key]} />
      ))}
    </div>
  );
}
