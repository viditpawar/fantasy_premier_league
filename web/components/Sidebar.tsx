"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_LINKS, isActive } from "./navLinks";
import { ThemeToggle } from "./ui/ThemeToggle";
import { CommandPaletteTrigger } from "./ui/CommandPalette";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border md:flex">
      <div className="glass flex h-full flex-col">
        <Link href="/" className="flex items-center gap-2.5 px-5 pb-2 pt-5">
          <span
            className="inline-block h-7 w-7 shrink-0 rounded-[9px]"
            style={{ background: "linear-gradient(135deg, var(--brand-purple-bright), var(--accent))" }}
          />
          <span className="truncate text-[15px] font-bold tracking-tight text-fg">FPL Cockpit</span>
        </Link>

        <nav className="mt-3 flex-1 overflow-y-auto px-3 py-1">
          <div className="section-label px-2.5 pb-1.5">Navigate</div>
          <ul className="flex flex-col gap-0.5">
            {NAV_LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              const Icon = link.icon;
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-[7px] text-[14px] font-medium transition-colors ${
                      active ? "text-white" : "text-fg hover:bg-surface-2"
                    }`}
                    style={active ? { background: "var(--accent)" } : undefined}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="truncate">{link.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          <CommandPaletteTrigger />
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
