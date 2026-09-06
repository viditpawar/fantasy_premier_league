"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS, isActive } from "./navLinks";
import { ThemeToggle } from "./ui/ThemeToggle";
import { CommandPaletteTrigger } from "./ui/CommandPalette";

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="glass sticky top-0 z-30 border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-4 py-2.5">
        <Link href="/" className="mr-2 flex items-center gap-2 font-extrabold tracking-tight text-fg">
          <span
            className="inline-block h-6 w-6 rounded-lg"
            style={{ background: "linear-gradient(135deg, var(--brand-purple-bright), var(--accent))" }}
          />
          <span className="hidden sm:inline">FPL Cockpit</span>
        </Link>

        <div className="hidden flex-1 items-center gap-0.5 md:flex">
          {NAV_LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors ${
                  active ? "text-fg" : "text-fg-muted hover:text-fg"
                }`}
              >
                {link.label}
                {active && (
                  <span
                    className="absolute inset-x-2 -bottom-[11px] h-[2px] rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                )}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <CommandPaletteTrigger />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
