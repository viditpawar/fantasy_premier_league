import { cache } from "react";
import { getWorkspace } from "./workspace";
import { getFixtureTickerData, getLatestGameweek, getPlanningGameweek, getPlayers, getPredictions, getSquad } from "./queries";
import { toStudioPlayers } from "./studio";
import { coversRoster } from "./predictions";

/** Shared read-only inputs for research, lineup drafts and deadline preparation. */
export const getPlanningWorkspace = cache(async () => {
  const workspace = await getWorkspace();
  const { sb, season, teamId } = workspace;
  const [sourceGameweek, target] = await Promise.all([getLatestGameweek(sb, teamId, season), getPlanningGameweek(sb, season)]);
  const [squad, pool, ticker, event, predictions] = await Promise.all([
    getSquad(sb, teamId, season, sourceGameweek), getPlayers(sb, season),
    getFixtureTickerData(sb, season, target ?? 39),
    target == null ? Promise.resolve({ data: null, error: null }) : sb.from("gameweeks").select("deadline_time").eq("season", season).eq("id", target).maybeSingle(),
    getPredictions(sb, season, target),
  ]);
  if (event.error) throw event.error;
  const owned = new Set(squad.map(p => p.playerCode));
  const predictionRun = predictions.run && coversRoster(predictions.byCode, [...pool, ...squad]) ? predictions.run : null;
  const players = pool.map(p => ({ ...p, inSquad: owned.has(p.playerCode),
    ...(predictionRun && predictions.byCode.get(p.playerCode)) }));
  return { ...workspace, sourceGameweek, target, squad, players, studioPlayers: toStudioPlayers(squad, players), ticker, predictionRun, deadline: event.data?.deadline_time as string | null ?? null };
});
