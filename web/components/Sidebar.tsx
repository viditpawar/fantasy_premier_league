"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./Brand";
import { NAV_LINKS, isActive } from "./navLinks";
import { IconArrowRight, IconPitch, IconSettings } from "./icons";
export function Sidebar({ season, manager, team, live = false }: { season: string; manager: string; team: string; live?: boolean }) {
  const pathname = usePathname();
  const initials = manager.split(" ").map((s) => s[0]).slice(0, 2).join("");
  return <aside className="app-sidebar" aria-label="Main navigation">
    <div className="px-2"><Brand /></div>
    <nav className="flex-1 overflow-y-auto pb-2">{(["Workspace", "Discover", "Strategy"] as const).map((group) => <div className="nav-group" key={group}><p>{group}</p>{NAV_LINKS.filter((link) => link.group === group).map(({ href, label, icon: Icon }) => <Link href={href} key={href} className="side-link" data-active={isActive(pathname, href)} aria-current={isActive(pathname, href) ? "page" : undefined}><Icon /><span>{label}</span>{href === "/live" && live && <span className="nav-live">LIVE</span>}</Link>)}</div>)}</nav>
    <div className="season-note"><IconPitch /><strong>One season. Every possibility.</strong><p>{season} season<br />Make your next move count.</p><Link href="/fixtures" className="text-link mt-3">Look ahead <IconArrowRight /></Link></div>
    <Link href="/settings" className="side-link" data-active={isActive(pathname, "/settings")}><IconSettings />Settings & information</Link>
    <Link href="/settings" className="sidebar-profile"><span className="avatar">{initials || "FP"}</span><div className="min-w-0 flex-1"><strong className="block truncate text-[11px] font-medium">{manager}</strong><span className="mt-0.5 block truncate text-[9px] text-fg-muted">{team}</span></div><IconArrowRight className="h-3 w-3 text-fg-subtle" /></Link>
  </aside>;
}
