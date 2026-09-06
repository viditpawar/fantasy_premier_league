import type { CSSProperties, ReactNode } from "react";

type Tone = "neutral" | "accent" | "brand" | "good" | "warning" | "critical";

const TONES: Record<Tone, CSSProperties> = {
  neutral: { background: "var(--surface-2)", color: "var(--fg-muted)" },
  accent: { background: "color-mix(in oklab, var(--accent) 18%, transparent)", color: "var(--accent)" },
  brand: {
    background: "linear-gradient(90deg, var(--brand-purple), var(--brand-purple-bright))",
    color: "#fff",
  },
  good: { background: "color-mix(in oklab, var(--good) 18%, transparent)", color: "var(--good)" },
  warning: { background: "color-mix(in oklab, var(--warning) 20%, transparent)", color: "var(--warning)" },
  critical: { background: "color-mix(in oklab, var(--critical) 18%, transparent)", color: "var(--critical)" },
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
  style,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${className}`}
      style={{ ...TONES[tone], ...style }}
    >
      {children}
    </span>
  );
}
