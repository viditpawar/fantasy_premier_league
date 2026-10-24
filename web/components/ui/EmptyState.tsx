import type { ReactNode } from "react";
import { IconPitch } from "../icons";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-16 text-center">
      <span className="insight-icon mb-3"><IconPitch /></span>
      <p className="text-base font-medium tracking-tight text-fg">{title}</p>
      {children && <div className="max-w-sm text-xs leading-6 text-fg-muted">{children}</div>}
    </div>
  );
}
