"use client";

import Link from "next/link";
import { ThemeToggle } from "./ui/ThemeToggle";
import { CommandPaletteTrigger } from "./ui/CommandPalette";

// Mobile-only top bar — on desktop, navigation lives in the sidebar instead.
export function Nav() {
  return (
    <nav className="glass sticky top-0 z-30 border-b border-border md:hidden">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-fg">
          <span
            className="inline-block h-6 w-6 rounded-[7px]"
            style={{ background: "linear-gradient(135deg, var(--brand-purple-bright), var(--accent))" }}
          />
          <span>FPL Cockpit</span>
        </Link>
        <div className="ml-auto flex items-center gap-1.5">
          <CommandPaletteTrigger />
          <ThemeToggle />
        </div>
      </div>
    </nav>
  );
}
