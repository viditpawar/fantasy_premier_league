import type { ChipAdvice } from "@/lib/types";
import { ChipStrategy } from "@/components/ChipStrategy";

const CHIP_ADVICE: ChipAdvice = {
  wildcard: {
    recommended: false,
    reason: "Hold. One starting midfielder needs attention and João Pedro is already on the bench. The other 13 players remain available, so one free transfer can address the immediate weakness without reshaping the squad.",
  },
  freeHit: {
    recommended: false,
    reason: "Hold. Every club has a GW9 fixture and your squad can field a legal XI. Save Free Hit for a blank week that leaves too few useful starters.",
  },
  benchBoost: {
    recommended: false,
    reason: "Hold. João Pedro is currently ruled out and Bijol's minutes have been uncertain. Your bench does not have four dependable appearances to boost this week.",
  },
  tripleCaptain: {
    recommended: false,
    reason: "Hold. Haaland is the regular captain pick at home to Brighton, but he has one fixture. Save Triple Captain for a later strong opportunity, often a double gameweek.",
  },
};

function deadlineInPhoenix(deadline: string | null) {
  if (!deadline) return "Saturday, 31 October at 4:00 a.m. Phoenix time";
  return `${new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Phoenix",
  }).format(new Date(deadline))} Phoenix time`;
}

export function GW9TransferPlan({ deadline }: { deadline: string | null }) {
  return (
    <section className="mb-8 rounded-2xl border border-accent/20 bg-accent/5 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="page-eyebrow">Personal GW9 plan · checked 30 October</p>
          <h2 className="max-w-3xl text-2xl font-medium tracking-[-.04em]">
            Use the free transfer on Stach → Neto if Stach stays doubtful.
          </h2>
          <p className="mt-2 text-[12px] leading-6 text-fg-muted">
            Deadline: {deadlineInPhoenix(deadline)}. This plan uses the last confirmed squad: one free transfer and £3.4m in the bank.
          </p>
        </div>
        <span className="rounded-full bg-surface-1 px-3 py-1.5 text-[10px] font-semibold text-accent">No hit · no chip</span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <p className="section-label">First choice · one transfer</p>
          <h3 className="mt-2 text-lg font-semibold">Stach → Neto</h3>
          <p className="mt-1 text-[11px] font-medium text-fg-muted">Midfielder · Neto costs £6.6m · estimated bank after move £2.8m</p>
          <ul className="mt-4 space-y-2 text-[11px] leading-6 text-fg-muted">
            <li>Stach is listed at a 50% chance after a foot injury. His GW4–7 returns were 3, 5, 2 and 2 points with full minutes, followed by 24 minutes and one point in GW8.</li>
            <li>Neto is available and played 82–90 minutes in each of GW4–8. His returns were 2, 2, 5, 15 and 3 points, so the recent haul is only one part of the case.</li>
            <li>Chelsea&apos;s next four are Man Utd at home, Sunderland away, Leeds at home and Nottingham Forest away. The first is a tougher fixture; the following three are a useful run.</li>
            <li>For GW9 alone, Stach has Bournemouth away (difficulty 3) and Neto has Man Utd at home (difficulty 4). This move is about minutes and the next three fixtures, not a one-week fixture upgrade.</li>
            <li>The saved selling price for Stach is £6.0m. Together with £3.4m bank, that covers Neto and leaves £2.8m. Chelsea would have two squad players, within the three-player limit.</li>
          </ul>
        </article>

        <article className="card p-5">
          <p className="section-label">What could change the call</p>
          <h3 className="mt-2 text-lg font-semibold">Check Stach&apos;s final availability</h3>
          <p className="mt-3 text-[11px] leading-6 text-fg-muted">
            If the official flag improves and team news supports a start, roll the transfer. That gives you two free transfers to work with next week. If the 50% flag remains, Neto is the safer minutes choice for the starting XI.
          </p>
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-[11px] font-semibold text-fg">Alternative midfield move: Stach → Manzambi</p>
            <p className="mt-1 text-[11px] leading-6 text-fg-muted">
              Manzambi costs £6.1m and has Fulham at home, Man Utd away, Sunderland at home and Ipswich away. His minutes in GW4–8 were 27, 71, 85, 71 and 65, with one point in the latest round. Choose him for the easier fixture run and lower price if you accept more minutes uncertainty.
            </p>
          </div>
          <details className="mt-4 border-t border-border pt-4 text-[11px] leading-6">
            <summary className="cursor-pointer font-semibold text-fg">If you prefer to fix the forward bench</summary>
            <p className="mt-2 text-fg-muted">
              João Pedro is currently at 0% with an unknown return date. João Pedro → Evanilson (£6.3m) is a reasonable alternative; Evanilson played 78–90 minutes in each of GW4–8 and has Leeds, Ipswich, Nottingham Forest and Fulham next. Since João Pedro was already on the bench, this leaves the 50%-fit Stach in your XI, so I rank it second.
            </p>
          </details>
        </article>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-surface-1 p-5">
        <p className="section-label">Your season is already turning</p>
        <p className="mt-2 text-[11px] leading-6 text-fg-muted">
          The worst dip was GW2 and GW3: you finished 35 and 3 points below those weeks&apos; averages, while hits cost 8 and 4 points. From GW4–8 you scored 320 points against a combined 279-point average, and made no points-cost transfers. Your rank improved from 8.88m after GW3 to 5.41m after GW8. Keep building on that run with a planned free transfer; the recent results do not call for a panic chip or hit.
        </p>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-surface-1 p-5">
        <p className="section-label">Suggested XI after Stach → Neto · 4–4–2</p>
        <p className="mt-2 text-[12px] leading-6 text-fg-muted">
          Raya; Rúben, Bogle, De Cuyper, Tarkowski; Tavernier, Groß, Cherki, Neto; Kostoulas, Haaland.
        </p>
        <p className="mt-2 text-[11px] leading-6 text-fg-muted">
          Captain Haaland (9.0 form, 8.2 points per game) at home to Brighton; vice-captain Tavernier (6.5 points per game) at home to Leeds. Bench: Mac Allister, Bijol, João Pedro; reserve goalkeeper Kinsky. Keep Raya: he has 49 season points and 6.1 points per game, compared with Kinsky&apos;s 32 and 4.0, despite Liverpool being the harder fixture.
        </p>
      </div>

      <div className="mt-6">
        <h3 className="mb-3 text-[13px] font-semibold">Chip call: save all four this week</h3>
        <ChipStrategy advice={CHIP_ADVICE} />
        <p className="mt-3 text-[10px] leading-5 text-fg-subtle">
          Your 25 October snapshot lists Wildcard, Free Hit, Bench Boost and Triple Captain as unused. FPL allows one chip per gameweek; the first set must be used by the GW19 deadline, with the second set opening from GW20. Check your live chip status before confirming anything.
        </p>
        <a href="https://fantasy.premierleague.com/transfers" target="_blank" rel="noreferrer" className="button-primary mt-4">Check your live team and transfers</a>
      </div>

      <p className="mt-5 border-t border-border pt-4 text-[10px] leading-5 text-fg-subtle">
        State check: your saved squad and selling prices were confirmed on 25 October. The public FPL feed confirms GW8 picks, but it does not show an unsubmitted GW9 draft. Recheck your live squad, bank and pending moves; player prices and availability can change before the deadline. This page does not make transfers or set your lineup.
      </p>
      <p className="mt-2 text-[10px] leading-5 text-fg-subtle">
        Sources: <a className="text-link" href="https://fantasy.premierleague.com/api/bootstrap-static/" target="_blank" rel="noreferrer">official player and fixture feed</a> · <a className="text-link" href="https://fantasy.premierleague.com/help/faqs" target="_blank" rel="noreferrer">official FPL chip rules</a>.
      </p>
    </section>
  );
}
