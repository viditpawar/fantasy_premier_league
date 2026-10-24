import { cache } from "react";
import { getSupabase } from "./supabase";
import { getCurrentSeason, getTeamId } from "./queries";
/** Share the manager context across the shell and page within a request. */
export const getWorkspace = cache(async () => {
  const sb = getSupabase();
  const [season, teamId] = await Promise.all([getCurrentSeason(sb), getTeamId(sb)]);
  const { data } = await sb.from("managers").select("name, player_first_name, player_last_name").eq("team_id", teamId).single();
  const manager = [data?.player_first_name, data?.player_last_name].filter(Boolean).join(" ") || "FPL manager";
  return { sb, season, teamId, manager, team: data?.name || "Your fantasy team" };
});
