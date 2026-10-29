/** A saved model decision is current only while both its inputs and deadline are fresh. */
export function advisorStatus(
  validation: { version?: number; state_verified?: boolean; state_captured_at?: string; data_refreshed_at?: string } | undefined,
  deadlineValue: string | null | undefined,
  gameweek: number,
  now = Date.now(),
) {
  const deadline = Date.parse(deadlineValue ?? "");
  const captured = Date.parse(validation?.state_captured_at ?? "");
  const verified = validation?.version === 2 && validation.state_verified === true;
  const expired = Number.isFinite(deadline) && deadline <= now;
  const fresh = Number.isFinite(captured) && now - captured <= 24 * 60 * 60 * 1000 && captured <= now + 5 * 60 * 1000;
  const refreshed = Date.parse(validation?.data_refreshed_at ?? "");
  const dataFresh = Number.isFinite(refreshed) && now - refreshed <= 6 * 60 * 60 * 1000 && refreshed <= now + 5 * 60 * 1000;
  const isCurrent = verified && !expired && fresh && dataFresh && Number.isFinite(deadline);
  const reviewNote = expired
    ? `Saved advice for GW${gameweek}. That deadline has passed; these picks are for reference.`
    : !verified
      ? "This advice predates the current decision model. Generate fresh advice to check minutes, the best legal XI and whether a transfer improves your squad."
      : !dataFresh
        ? "The player and fixture data behind this advice is older than six hours or unconfirmed. Refresh the data and generate new advice before acting."
      : !isCurrent
        ? "This advice uses an older squad snapshot. Check any transfers, prices and team news that have changed since it was saved."
        : null;
  return { isCurrent, reviewNote };
}
