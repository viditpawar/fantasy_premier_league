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
