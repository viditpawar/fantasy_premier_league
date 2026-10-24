import type { ComponentType } from "react";
import { IconBolt, IconCalendar, IconChart, IconGrid, IconPitch, IconUsers, IconTrophy, IconSparkles } from "./icons";
export interface NavLink { href: string; label: string; icon: ComponentType<{ className?: string }>; group: "Workspace" | "Discover" | "Strategy"; }
export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Overview", icon: IconGrid, group: "Workspace" },
  { href: "/squad", label: "My squad", icon: IconPitch, group: "Workspace" },
  { href: "/live", label: "Match centre", icon: IconBolt, group: "Workspace" },
  { href: "/dashboard", label: "Analytics", icon: IconChart, group: "Discover" },
  { href: "/players", label: "Player explorer", icon: IconUsers, group: "Discover" },
  { href: "/fixtures", label: "Fixtures", icon: IconCalendar, group: "Discover" },
  { href: "/transfers", label: "AI advisor", icon: IconSparkles, group: "Strategy" },
  { href: "/leagues", label: "Leagues & cups", icon: IconTrophy, group: "Strategy" },
];
export function isActive(pathname: string, href: string): boolean { return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`); }
