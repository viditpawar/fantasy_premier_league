"use client";
import { useId, useState } from "react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ManagerGameweekRow } from "@/lib/types";
import { compactNumber } from "@/lib/format";
import { IconArrowRight } from "../icons";
export function PerformanceChart({ rows }: { rows: ManagerGameweekRow[] }) {
  const [metric, setMetric] = useState<"points" | "overallRank">("points");
  const [range, setRange] = useState<"all" | "5">("all");
  const id = useId().replace(/:/g, "");
  const data = range === "5" ? rows.slice(-5) : rows;
  const latest = rows.at(-1);
  const value = metric === "points" ? latest?.totalPoints : latest?.overallRank;
  return <section className="card performance-card">
    <div className="panel-heading"><div><h2>Season in perspective</h2><p className="panel-subtitle">Small decisions. A season of progress.</p></div><div className="chart-tabs" aria-label="Chart metric">{(["points", "overallRank"] as const).map((key) => <button key={key} aria-pressed={metric === key} onClick={() => setMetric(key)}>{key === "points" ? "Points" : "Rank"}</button>)}</div></div>
    <div className="chart-summary"><strong>{value?.toLocaleString("en-GB") ?? "—"}</strong><span>{metric === "points" ? "points this season" : "overall rank"}</span></div>
    <div className="h-[205px] min-w-0 px-3 pt-3" role="img" aria-label={`${metric === "points" ? "Gameweek points" : "Overall rank"} across ${data.length} gameweeks`}>
      {data.length < 2 ? <p className="py-14 text-center text-[11px] text-fg-muted">Your progress chart starts after two gameweeks.</p> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 10, right: 15, bottom: 0, left: -22 }}><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity={.13} /><stop offset="100%" stopColor="var(--accent)" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} strokeDasharray="3 5" /><XAxis dataKey="gameweek" axisLine={false} tickLine={false} tickMargin={10} minTickGap={23} tickFormatter={(v) => `GW ${v}`} /><YAxis axisLine={false} tickLine={false} reversed={metric === "overallRank"} tickFormatter={(v) => compactNumber(v)} tickCount={4} /><Tooltip contentStyle={{ background: "var(--surface-1)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 11, boxShadow: "var(--shadow-card)" }} labelFormatter={(v) => `Gameweek ${v}`} formatter={(v) => [Number(v).toLocaleString("en-GB"), metric === "points" ? "Points" : "Overall rank"]} /><Area type="monotone" dataKey={metric} stroke="var(--accent)" strokeWidth={2} fill={`url(#${id})`} dot={false} activeDot={{ r: 4, stroke: "var(--surface-1)", strokeWidth: 3 }} isAnimationActive={false} /></AreaChart></ResponsiveContainer>}
    </div>
    <div className="chart-footer"><div className="chart-tabs"><button aria-pressed={range === "all"} onClick={() => setRange("all")}>Full season</button><button aria-pressed={range === "5"} onClick={() => setRange("5")}>Last 5 GWs</button></div><Link href="/dashboard" className="text-link">View analytics<IconArrowRight /></Link></div>
  </section>;
}
