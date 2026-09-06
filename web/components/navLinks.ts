import type { ComponentType } from "react";
import {
  IconBolt,
  IconCalendar,
  IconChart,
  IconPitch,
  IconSearch,
  IconShield,
  IconSwap,
} from "./icons";

export interface NavLink {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Squad", icon: IconPitch },
  { href: "/live", label: "Live", icon: IconBolt },
  { href: "/fixtures", label: "Fixtures", icon: IconCalendar },
  { href: "/players", label: "Players", icon: IconSearch },
  { href: "/dashboard", label: "Analytics", icon: IconChart },
  { href: "/transfers", label: "Transfers", icon: IconSwap },
  { href: "/leagues", label: "Leagues", icon: IconShield },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
