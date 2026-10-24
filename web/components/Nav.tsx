"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brand } from "./Brand";
import { NAV_LINKS, isActive } from "./navLinks";
import { IconGrid, IconMenu, IconSearch, IconSettings } from "./icons";
import { ThemeToggle } from "./ui/ThemeToggle";
export function Nav({ season, manager }: { season: string; manager: string }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const active = NAV_LINKS.find((link) => isActive(pathname, link.href));
  useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, []);
  const initials = manager.split(" ").map((s) => s[0]).slice(0, 2).join("");
  return <>
    <header className="app-topbar">
      <div className="breadcrumb desktop-breadcrumb"><Link href="/" aria-label="Overview"><IconGrid className="h-3.5 w-3.5" /></Link><span className="text-border-strong">/</span><span>Workspace</span><span className="text-border-strong">/</span><span>{active?.label ?? "Settings"}</span></div>
      <div className="md:hidden"><Brand compact /></div>
      <div className="top-actions"><span className="hidden lg:flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1.5 text-[9px] text-fg-muted"><span className="status-dot text-good" />{season} season</span><button className="top-search" onClick={() => window.dispatchEvent(new Event("fpl:open-command-palette"))} aria-label="Search pages and players"><IconSearch className="h-4 w-4" /><span>Search anything</span><kbd>⌘ K</kbd></button><span className="hidden md:block h-5 w-px bg-border" /><ThemeToggle /><Link href="/settings" className="avatar top-avatar" aria-label="Your workspace settings">{initials || "FP"}</Link><button className="icon-button mobile-menu-trigger" onClick={() => setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label={menuOpen ? "Close navigation" : "Open navigation"}><IconMenu /></button></div>
    </header>
    {menuOpen && <><div className="fixed inset-0 z-40 bg-black/15 md:hidden" onClick={() => setMenuOpen(false)} aria-hidden="true" /><nav id="mobile-menu" className="mobile-nav-panel md:hidden" aria-label="All pages">{NAV_LINKS.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMenuOpen(false)} className="side-link" data-active={isActive(pathname, href)} aria-current={isActive(pathname, href) ? "page" : undefined}><Icon />{label}</Link>)}<Link href="/settings" className="side-link" onClick={() => setMenuOpen(false)}><IconSettings />Settings & information</Link></nav></>}
  </>;
}
