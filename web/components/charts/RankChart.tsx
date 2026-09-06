"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compactNumber } from "@/lib/format";
import { ChartTooltip } from "./ChartFrame";

export function RankChart({
  data,
}: {
  data: { gameweek: number; overallRank: number | null }[];
}) {
  const points = data.filter((d) => d.overallRank != null) as {
    gameweek: number;
    overallRank: number;
  }[];
  if (points.length < 2) {
    return <p className="py-8 text-center text-sm text-fg-muted">Not enough gameweeks yet.</p>;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%" debounce={0}>
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="rankFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="gameweek"
            tickFormatter={(v) => `GW${v}`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            reversed
            width={48}
            tickFormatter={(v) => compactNumber(v)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltip
                active={active}
                label={payload?.[0] ? `Gameweek ${payload[0].payload.gameweek}` : ""}
                rows={[
                  {
                    key: "rank",
                    label: "Overall rank",
                    value: payload?.[0] ? Number(payload[0].value).toLocaleString() : "",
                    color: "var(--accent)",
                  },
                ]}
              />
            )}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="overallRank"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#rankFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
