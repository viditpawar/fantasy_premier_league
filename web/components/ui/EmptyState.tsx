import type { ReactNode } from "react";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-1.5 px-6 py-10 text-center">
      <p className="font-semibold text-fg">{title}</p>
      {children && <p className="max-w-sm text-sm text-fg-muted">{children}</p>}
    </div>
  );
}
