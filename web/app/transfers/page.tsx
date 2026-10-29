import type { Metadata } from "next";
import Link from "next/link";
import { getWorkspace } from "@/lib/workspace";
import { getAdvisorSuggestion, getPlayers } from "@/lib/queries";
import { Hero } from "@/components/ui/Hero";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { TransferCompare } from "@/components/TransferCompare";
import { AdvisorEvidence } from "@/components/AdvisorEvidence";
import { ChipStrategy } from "@/components/ChipStrategy";
import { PlayerKit } from "@/components/PlayerKit";
import { FDRCell } from "@/components/ui/FDRCell";
import { IconAlertTriangle, IconArrowRight, IconSparkles, IconStar } from "@/components/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI advisor" };
export default async function TransfersPage() {
  const { sb, season, teamId } = await getWorkspace();
  const [suggestion, players] = await Promise.all([getAdvisorSuggestion(sb, teamId, season), getPlayers(sb, season, new Set(), { withFixtures: true })]);
  const byName = new Map(players.map((p) => [p.player.toLowerCase(), p]));
  const captain = suggestion ? byName.get(suggestion.captain.toLowerCase()) : null;
  return <main className="page-container animate-fade-in">
    <Hero title="Your next move, considered." eyebrow={suggestion ? `Your AI advisor · GW${suggestion.forGameweek}` : "Your AI advisor"} icon={<IconSparkles />} subtitle="A thoughtful second opinion. Grounded in your squad, recent form and the fixtures ahead." stats={suggestion ? [{ label: "Free transfers in this snapshot", value: suggestion.unlimitedTransfers ? "Unlimited" : suggestion.freeTransfers ?? "Unconfirmed", accent: true }, { label: "Transfer ideas", value: suggestion.recommendedTransfers.length }, { label: "Captain pick", value: suggestion.captain }] : undefined} />
    {!suggestion ? <EmptyState title="Your next insight is on its way.">Your advice will appear here when it’s available. Until then, form and fixtures are a good place to start.<div className="mt-5 flex justify-center gap-5"><Link href="/players" className="text-link">Explore players<IconArrowRight /></Link><Link href="/fixtures" className="text-link">Look ahead<IconArrowRight /></Link></div></EmptyState> : <>
      {suggestion.reviewNote && <p role="status" className="mb-7 rounded-2xl border border-warning/20 bg-warning/5 px-6 py-5 text-[12px] leading-6 text-fg-muted">{suggestion.reviewNote}</p>}
      {suggestion.decision && <AdvisorEvidence decision={suggestion.decision} players={players} transfers={suggestion.recommendedTransfers} />}
      <section className="mb-7 rounded-2xl border border-accent/15 bg-accent/5 px-6 py-5"><div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-accent"><IconSparkles className="h-3.5 w-3.5" />THE THINKING BEHIND THE PICKS</div><p className="text-[13px] leading-7 text-fg-muted">{suggestion.summary}</p></section>
      {suggestion.lineupWatch.length > 0 && <section className="mb-7 rounded-2xl border border-warning/20 bg-warning/5 px-6 py-5"><h2 className="flex items-center gap-2 text-[12px] font-medium text-warning"><IconAlertTriangle className="h-4 w-4" />A quick check before the deadline</h2><ul className="mt-3 space-y-2">{suggestion.lineupWatch.map((note, i) => <li key={i} className="flex gap-2 text-[11px] leading-6 text-fg-muted"><span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-warning" />{note}</li>)}</ul></section>}
      <div className="overview-grid">
        <div className="flex min-w-0 flex-col gap-7"><section><SectionHeader title="A few ways forward" hint="Start with the first idea. The other options are alternatives if prices or team news change." />{suggestion.recommendedTransfers.length ? <div className="space-y-4">{suggestion.recommendedTransfers.map((transfer, index) => <TransferCompare key={index} transfer={transfer} rank={index + 1} byName={byName} />)}</div> : <div className="card p-6 text-[12px] leading-6 text-fg-muted">The advice is to hold your squad this week. Save the transfer for another opportunity.</div>}</section><section><SectionHeader title="Is a points hit worth it?" hint="A four-point cost needs a convincing reason." />{suggestion.hitTransfers.length ? <div className="space-y-4">{suggestion.hitTransfers.map((transfer, index) => <TransferCompare key={index} transfer={transfer} hit byName={byName} />)}</div> : <div className="card flex items-start gap-3 p-6"><span className="insight-icon shrink-0"><IconStar /></span><div><h3 className="text-[12px] font-medium">Keep your points.</h3><p className="mt-1 text-[11px] leading-6 text-fg-muted">No points hit is recommended. The ranking scores do not establish whether a move will repay four points.</p></div></div>}</section></div>
        <aside className="flex min-w-0 flex-col gap-5"><section className="card insight-card"><div className="insight-eyebrow"><span className="insight-icon"><IconStar /></span>The armband decision</div>{captain && <PlayerKit code={captain.teamCode} className="mx-auto mt-6 h-20 w-20" />}<p className="mt-5 text-center text-[9px] uppercase tracking-widest text-fg-subtle">Recommended captain</p><h2 className="!mt-2 text-center">{suggestion.captain}</h2>{captain?.upcomingFixtures && <div className="mt-4 flex flex-wrap justify-center gap-1.5">{captain.upcomingFixtures.map((fixture, i) => <FDRCell key={i} {...fixture} size="sm" />)}</div>}<p className="insight-copy mt-5">{suggestion.captaincyReasoning}</p><div className="mt-5 flex justify-between gap-3 border-t border-border pt-4 text-[11px]"><span className="text-fg-muted">Vice-captain</span><span className="font-medium">{suggestion.viceCaptain}</span></div></section><section className="rounded-2xl border border-border p-6"><p className="section-label">Your team. Your call.</p><p className="mt-3 text-[11px] leading-6 text-fg-muted">Use these insights as a starting point. Review the latest team news and confirm your moves on the official FPL website.</p><a href="https://fantasy.premierleague.com/transfers" target="_blank" rel="noreferrer" className="button-primary mt-5 w-full">Open FPL transfers ↗</a></section></aside>
      </div>
      {suggestion.chipAdvice && <section className="mt-8"><SectionHeader title="Play the long game" hint="Chip strategy for your squad and the upcoming calendar." /><ChipStrategy advice={suggestion.chipAdvice} /></section>}
      <p className="mt-7 text-[9px] text-fg-subtle">AI advice for GW{suggestion.forGameweek} · Generated {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Phoenix" }).format(new Date(suggestion.generatedAt))} MST</p>
    </>}
  </main>;
}
