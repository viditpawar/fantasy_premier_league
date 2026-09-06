import type { ReactNode } from "react";

export function SectionHeader({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="section-label">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-fg-subtle">{hint}</p>}
      </div>
      {action}
    </div>
  );
}
