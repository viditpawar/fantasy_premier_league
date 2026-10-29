import type { ComponentType } from "react";
import { IconBolt, IconCalendar, IconChart, IconGrid, IconPitch, IconUsers, IconTrophy, IconSparkles, IconSwap, IconStar, IconFlask, IconTarget } from "./icons";
export interface NavLink { href: string; label: string; icon: ComponentType<{ className?: string }>; group: "Workspace" | "Discover" | "Strategy"; }
export const NAV_LINKS: NavLink[] = [
  { href: "/", label: "Overview", icon: IconGrid, group: "Workspace" },
  { href: "/gameweek", label: "Gameweek HQ", icon: IconTarget, group: "Workspace" },
  { href: "/squad", label: "My squad", icon: IconPitch, group: "Workspace" },
  { href: "/lineup", label: "Lineup studio", icon: IconUsers, group: "Workspace" },
  { href: "/live", label: "Match centre", icon: IconBolt, group: "Workspace" },
  { href: "/dashboard", label: "Analytics", icon: IconChart, group: "Discover" },
  { href: "/lab", label: "Research lab", icon: IconFlask, group: "Discover" },
  { href: "/players", label: "Player explorer", icon: IconUsers, group: "Discover" },
  { href: "/watchlist", label: "Watchlist", icon: IconStar, group: "Discover" },
  { href: "/fixtures", label: "Fixtures", icon: IconCalendar, group: "Discover" },
  { href: "/transfers", label: "AI advisor", icon: IconSparkles, group: "Strategy" },
  { href: "/planner", label: "Transfer planner", icon: IconSwap, group: "Strategy" },
  { href: "/leagues", label: "Leagues & cups", icon: IconTrophy, group: "Strategy" },
];
export function isActive(pathname: string, href: string): boolean { return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`); }
