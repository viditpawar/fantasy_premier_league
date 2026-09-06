import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  as: Tag = "div",
  interactive = false,
}: {
  children: ReactNode;
  className?: string;
  as?: React.ElementType;
  interactive?: boolean;
}) {
  return (
    <Tag
      className={`card ${
        interactive
          ? "transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-pop)]"
          : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
