"use client";

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  size = "md",
  ariaLabel,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-surface-2 p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`rounded-[7px] font-semibold transition-colors ${pad} ${
              active
                ? "bg-surface-1 text-fg shadow-[var(--shadow-card)]"
                : "text-fg-muted hover:text-fg"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
