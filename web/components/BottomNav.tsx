"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS, isActive } from "./navLinks";
export function BottomNav() {
  const pathname = usePathname();
  return <nav aria-label="Quick navigation" className="glass fixed inset-x-0 bottom-0 z-30 border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden"><div className="flex items-stretch justify-around px-2">{NAV_LINKS.filter((link) => ["/", "/squad", "/live", "/transfers", "/leagues"].includes(link.href)).map(({ href, label, icon: Icon }) => <Link href={href} key={href} aria-current={isActive(pathname, href) ? "page" : undefined} className={`flex flex-1 flex-col items-center gap-1 py-3 text-[8px] ${isActive(pathname, href) ? "text-accent" : "text-fg-muted"}`}><Icon className="h-[18px] w-[18px]" />{label === "Leagues & cups" ? "Leagues" : label}</Link>)}</div></nav>;
}
