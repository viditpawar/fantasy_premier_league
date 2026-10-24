import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { DataFreshness } from "@/components/DataFreshness";
import { Nav } from "@/components/Nav";
import { Sidebar } from "@/components/Sidebar";
import { BottomNav } from "@/components/BottomNav";
import { CommandPalette, type CommandItem } from "@/components/ui/CommandPalette";
import { PageTransition } from "@/components/PageTransition";
import { getWorkspace } from "@/lib/workspace";
import { getGameweekMeta, getPlayers } from "@/lib/queries";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Overview · FPL Cockpit", template: "%s · FPL Cockpit" },
  description: "A clearer view of your fantasy season. Your squad, performance, fixtures and next move, beautifully connected.",
  icons: { icon: "/icon.svg" },
};
const NO_FLASH = `(function(){try{var t=localStorage.getItem('theme');document.documentElement.dataset.theme=t==='dark'?'dark':'light';}catch(e){}})();`;

async function loadShell() {
  try {
    const { sb, season, manager, team } = await getWorkspace();
    const [meta, players] = await Promise.all([
      getGameweekMeta(sb, season).catch(() => null),
      getPlayers(sb, season, new Set()).catch(() => []),
    ]);
    const commandItems: CommandItem[] = players.map((p) => ({ id: `player:${p.playerCode}`, label: p.player, sub: `${p.team} · ${p.position}`, href: `/players/${p.playerCode}`, group: "Players" }));
    return { season, manager, team, live: !!meta?.current && !meta.current.finished, commandItems };
  } catch {
    return { season: "FPL", manager: "Your workspace", team: "Fantasy Premier League", live: false, commandItems: [] as CommandItem[] };
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const shell = await loadShell();
  return <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{ __html: NO_FLASH }} /></head>
    <body className="flex min-h-full">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <Sidebar {...shell} />
      <div className="min-w-0 flex-1">
        <Nav season={shell.season} manager={shell.manager} />
        <div id="main-content" tabIndex={-1} className="pb-20 outline-none md:pb-0">
          <PageTransition>{children}</PageTransition>
          <footer className="page-container !pt-0"><div className="app-footer"><span><DataFreshness compact /><br />Made for the love of the game.<span className="mx-2 text-border-strong">·</span>FPL Cockpit</span><span>Independent of the Premier League.<span className="mx-2 text-border-strong">·</span><Link href="/settings" className="hover:text-fg">Data & information ↗</Link></span></div></footer>
        </div>
      </div>
      <BottomNav /><CommandPalette items={shell.commandItems} />
    </body>
  </html>;
}
