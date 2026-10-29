import type { AdvisorDecision, AdvisorLineup, PlayerSeasonRow, SuggestedTransfer } from "@/lib/types";

export function AdvisorEvidence({ decision, players, transfers }: {
  decision: AdvisorDecision; players: PlayerSeasonRow[]; transfers: SuggestedTransfer[];
}) {
  const byId = new Map(players.map((player) => [player.playerId, player.player]));
  const names = (ids: number[]) => ids.map((id) => byId.get(id) ?? `Player ${id}`).join(", ");
  const options = transfers.map((transfer) => ({
    transfer,
    option: decision.transfer_options.find((option) => option.player_out === transfer.player_out && option.player_in === transfer.player_in),
  }));
  const primary = options[0];
  const selected = primary?.option?.lineup ?? decision.lineup;
  function lineupDetails(lineup: AdvisorLineup) {
    return <>
      <p className="mt-3 text-[12px] leading-6 text-fg-muted"><strong className="text-fg">{lineup.formation}:</strong> {names(lineup.starters)}</p>
      <p className="mt-2 text-[11px] leading-6 text-fg-muted"><strong>Outfield bench, in order:</strong> {names(lineup.bench.slice(0, 3))}</p>
      <p className="mt-1 text-[11px] leading-6 text-fg-muted"><strong>Reserve goalkeeper:</strong> {names(lineup.bench.slice(3))}</p>
      {lineup.reliable_outfield_bench && <p className="mt-2 text-[11px] leading-6 text-fg-muted">Cover with established minutes: {lineup.reliable_outfield_bench.length ? names(lineup.reliable_outfield_bench) : "none confirmed"}. Based on recent minutes and current availability.</p>}
      {lineup.selection_note && <p className="mt-2 text-[11px] leading-6 text-fg-muted">{lineup.selection_note}</p>}
      {!!lineup.warnings?.length && <ul className="mt-2 space-y-1 text-[11px] leading-6 text-warning">{lineup.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
    </>;
  }
  return <section className="mb-7 rounded-2xl border border-border px-6 py-5">
    <h2 className="text-[13px] font-medium">Your XI and bench{primary?.option?.lineup ? ` after ${primary.transfer.player_out} → ${primary.transfer.player_in}` : " without a transfer"}</h2>
    {lineupDetails(selected)}
    {primary?.option?.lineup && <details className="mt-4 border-t border-border pt-3 text-[12px]"><summary className="cursor-pointer font-medium">Compare with keeping your squad</summary>{lineupDetails(decision.lineup)}</details>}
    {options.slice(1).map(({ transfer, option }) => option?.lineup && <details key={`${transfer.player_out}-${transfer.player_in}`} className="mt-3 border-t border-border pt-3 text-[12px]"><summary className="cursor-pointer font-medium">Alternative: {transfer.player_out} → {transfer.player_in}</summary>{lineupDetails(option.lineup)}</details>)}
    <p className="mt-4 text-[11px] leading-6 text-fg-muted">Each transfer has its own XI and bench. Choose one alternative. Automatic substitutes preserve a legal formation and require a starter to play zero minutes across the whole gameweek; even a brief cameo prevents a substitution. Your reserve goalkeeper covers only the goalkeeper.</p>
    <p className="mt-2 text-[10px] leading-5 text-fg-subtle">All 15 players are considered before comparing transfers across {decision.horizon} gameweeks. Rankings are heuristic scores, not expected points. Review the lineup and late team news before the deadline.</p>
  </section>;
}
