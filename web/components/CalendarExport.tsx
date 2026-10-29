"use client";
import { useState } from "react";
import { deadlineCalendar } from "@/lib/studio";
import { downloadText } from "@/lib/download";
import { IconCalendar } from "./icons";
export function CalendarExport({ deadline, gameweek, season }: { deadline: string | null; gameweek: number | null; season: string }) {
  const [error, setError] = useState("");
  return <><button className="button-secondary" disabled={!deadline || gameweek == null} onClick={() => { try { downloadText(`fpl-gw${gameweek}-deadline.ics`, deadlineCalendar(deadline!, gameweek!, season), "text/calendar;charset=utf-8"); setError(""); } catch { setError("The deadline is unavailable. Refresh the page and try again."); } }}><IconCalendar />Add deadline to calendar</button>{error && <p role="alert" className="mt-2 text-xs text-warning">{error}</p>}</>;
}
