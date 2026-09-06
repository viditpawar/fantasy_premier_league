"use client";

import {
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./ChartFrame";

export function PointsVsAverageChart({
  data,
}: {
  data: { gameweek: number; points: number; averageEntryScore: number | null }[];
}) {
  if (data.length < 1) {
    return <p className="py-8 text-center text-sm text-fg-muted">No gameweeks played yet.</p>;
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%" debounce={0}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <XAxis dataKey="gameweek" tickFormatter={(v) => `GW${v}`} axisLine={false} tickLine={false} />
          <YAxis width={32} axisLine={false} tickLine={false} />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            content={({ active, payload }) => (
              <ChartTooltip
                active={active}
                label={payload?.[0] ? `Gameweek ${payload[0].payload.gameweek}` : ""}
                rows={[
                  {
                    key: "you",
                    label: "Your points",
                    value: payload?.[0]?.payload.points ?? "",
                    color: "var(--accent)",
                  },
                  {
                    key: "avg",
                    label: "Global average",
                    value: payload?.[0]?.payload.averageEntryScore ?? "—",
                    color: "var(--fg-subtle)",
                  },
                ]}
              />
            )}
          />
          <Bar dataKey="points" radius={[4, 4, 0, 0]} fill="var(--accent)" maxBarSize={26} isAnimationActive={false} />
          <Line
            isAnimationActive={false}
            type="monotone"
            dataKey="averageEntryScore"
            stroke="var(--fg-subtle)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
