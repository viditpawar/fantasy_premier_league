type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconTrophy({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 5H5a3 3 0 0 0 3 3.5M16 5h3a3 3 0 0 1-3 3.5" />
      <path d="M12 13v3M9 20h6M10 20v-2.5a2 2 0 0 1 4 0V20" />
    </svg>
  );
}

export function IconTrendingUp({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15 7h6v6" />
    </svg>
  );
}

export function IconWallet({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-4" />
      <rect x="15" y="11" width="6" height="5" rx="1" />
    </svg>
  );
}

export function IconPiggyBank({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 12a6 6 0 0 1 6-6h5l2 2h1a1 1 0 0 1 1 1v2l-2 1v2l-2 1v2H9v-2a6 6 0 0 1-5-3Z" />
      <circle cx="9" cy="12" r="0.5" fill="currentColor" />
      <path d="M4 12H2" />
    </svg>
  );
}

export function IconSwap({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 8h13l-3-3M20 16H7l3 3" />
    </svg>
  );
}

export function IconShield({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
    </svg>
  );
}

export function IconPitch({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 12h18M12 4v16" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M3 9h3v6H3M21 9h-3v6h3" />
    </svg>
  );
}

export function IconChart({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 19h16M7 16V9M12 16V5M17 16v-4" />
    </svg>
  );
}

export function IconCalendar({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function IconUsers({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M21 20a6 6 0 0 0-4-5.66" />
    </svg>
  );
}

export function IconSearch({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </svg>
  );
}

export function IconList({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

export function IconBolt({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  );
}

export function IconClock({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconArrowLeft({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}
