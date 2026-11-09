/** Shared checks for published forecasts before they reach lineup decisions. */
export const LEARNED_MODEL_VERSION = "learned-hgb-v3";
export const MAX_PREDICTION_AGE_HOURS = 24;

export function predictionRunUsable(run: {
  model_version: string; trained_through: number; from_gameweek: number | null;
  gate_passed: boolean; generated_at: string;
}, target: number, latestFinished: number, now = Date.now()): boolean {
  const age = now - Date.parse(run.generated_at);
  return run.model_version === LEARNED_MODEL_VERSION && run.gate_passed
    && run.trained_through <= latestFinished && latestFinished - run.trained_through <= 2
    && run.from_gameweek != null && run.from_gameweek <= target
    && Number.isFinite(age) && age >= 0 && age <= MAX_PREDICTION_AGE_HOURS * 3600000;
}

export function predictionRows(rows: {
  player_code: number; gameweek: number; predicted_points: number | string; p60: number | string | null;
}[], weeks: number[]) {
  const byCode = new Map<number, { predicted: Record<number, number>; p60: number | null }>();
  for (const row of rows) {
    const points = Number(row.predicted_points), p60 = row.p60 == null ? null : Number(row.p60);
    if (!Number.isFinite(points) || (p60 != null && (!Number.isFinite(p60) || p60 < 0 || p60 > 1))) return null;
    const entry = byCode.get(row.player_code) ?? { predicted: {}, p60: null };
    entry.predicted[row.gameweek] = points;
    if (row.gameweek === weeks[0]) entry.p60 = p60;
    byCode.set(row.player_code, entry);
  }
  if (!byCode.size || [...byCode.values()].some(entry => weeks.some(gw => !(gw in entry.predicted)))) return null;
  return byCode;
}
