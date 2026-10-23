"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS, isActive } from "./navLinks";

// Mobile-only tab bar. A trimmed subset of the nav for thumb reach —
// Transfers was missing here even though it's a core weekly-use page.
const MOBILE_LINKS = NAV_LINKS.filter((l) =>
  ["/", "/live", "/transfers", "/fixtures", "/players", "/leagues"].includes(l.href),
);

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="glass fixed inset-x-0 bottom-0 z-30 border-t border-border pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-auto flex max-w-6xl items-stretch justify-around">
        {MOBILE_LINKS.map((link) => {
          const active = isActive(pathname, link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-1 flex-col items-center gap-0.5 px-0.5 py-2 text-[9px] font-semibold whitespace-nowrap transition-colors ${
                active ? "text-accent" : "text-fg-muted"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
