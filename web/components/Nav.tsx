"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Squad" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/transfers", label: "Transfers" },
  { href: "/leagues", label: "Leagues" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-20 border-b border-white/10 bg-[#060714]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-4xl items-center gap-1 px-4 py-3 sm:gap-2">
        <span className="mr-3 flex items-center gap-2 font-extrabold tracking-tight text-white">
          <span
            className="inline-block h-6 w-6 rounded-md"
            style={{ background: "linear-gradient(135deg, var(--accent-purple-bright), var(--accent-green))" }}
          />
          My FPL
        </span>
        {LINKS.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                active ? "text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {link.label}
              {active && (
                <span
                  className="absolute inset-x-2 -bottom-[13px] h-[2px] rounded-full"
                  style={{ background: "linear-gradient(90deg, var(--accent-cyan), var(--accent-green))" }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
