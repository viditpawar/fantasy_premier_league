import type { ReactNode } from "react";

export function SectionHeader({
  title,
  hint,
  action,
}: {
  title: ReactNode;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-1.5 text-[14px] font-semibold tracking-tight text-fg">{title}</h2>
        {hint && <p className="mt-1.5 max-w-2xl text-[11px] leading-5 text-fg-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
