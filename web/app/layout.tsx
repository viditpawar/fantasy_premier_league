import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { BottomNav } from "@/components/BottomNav";
import { GameweekStrip } from "@/components/GameweekStrip";
import { CommandPalette, type CommandItem } from "@/components/ui/CommandPalette";
import { getSupabase } from "@/lib/supabase";
import {
  getCurrentSeason,
  getGameweekMeta,
  getLiveGameweek,
  getPlayers,
  getTeamId,
} from "@/lib/queries";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "FPL Cockpit", template: "%s · FPL Cockpit" },
  description: "A modern Fantasy Premier League cockpit — squad, fixtures, analytics, live scores.",
};

const NO_FLASH = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

async function loadShell(): Promise<{
  strip: React.ComponentProps<typeof GameweekStrip> | null;
  commandItems: CommandItem[];
}> {
  try {
    const sb = getSupabase();
    const season = await getCurrentSeason(sb);
    const [{ current, next }, teamId] = await Promise.all([
      getGameweekMeta(sb, season),
      getTeamId(sb).catch(() => null),
    ]);

    const gw = current ?? next;
    let liveTotal: number | null = null;
    let phase: "live" | "upcoming" | "done" = "done";
    if (current && !current.finished) {
      phase = "live";
      if (teamId) liveTotal = (await getLiveGameweek(sb, teamId, season).catch(() => null))?.liveTotal ?? null;
    } else if (next) {
      phase = "upcoming";
    }

    const squadCodes = new Set<number>();
    const players = await getPlayers(sb, season, squadCodes).catch(() => []);
    const commandItems: CommandItem[] = players.slice(0, 700).map((p) => ({
      id: `player:${p.playerCode}`,
      label: p.player,
      sub: `${p.team} · ${p.position}`,
      href: `/players/${p.playerCode}`,
      group: "Players",
    }));

    return {
      strip: gw
        ? {
            gwName: gw.name,
            deadline: (next ?? current)?.deadlineTime ?? null,
            averageScore: (current ?? next)?.averageEntryScore ?? null,
            highestScore: (current ?? next)?.highestScore ?? null,
            phase,
            liveTotal,
          }
        : null,
      commandItems,
    };
  } catch {
    return { strip: null, commandItems: [] };
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { strip, commandItems } = await loadShell();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH }} />
      </head>
      <body className="flex min-h-full flex-col overflow-x-hidden">
        <Nav />
        {strip && <GameweekStrip {...strip} />}
        <div className="flex-1 overflow-x-clip pb-20 md:pb-0">{children}</div>
        <BottomNav />
        <CommandPalette items={commandItems} />
      </body>
    </html>
  );
}
