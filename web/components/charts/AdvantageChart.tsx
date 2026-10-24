"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ManagerGameweekRow } from "@/lib/types";
import { advantageSeries } from "@/lib/analytics";
import { signed } from "@/lib/format";
import { ChartTooltip } from "./ChartFrame";

export function AdvantageChart({ rows }: { rows: ManagerGameweekRow[] }) {
  const id = useId().replace(/:/g, "");
  const data = advantageSeries(rows);
  const known = data.filter((row) => row.advantage != null);
  if (known.length < 2)
    return (
      <p className="py-20 text-center text-xs text-fg-muted">
        This chart needs two gameweeks with an available average.
      </p>
    );
  const color =
    (known.at(-1)?.advantage ?? 0) >= 0 ? "var(--accent)" : "var(--critical)";
  return (
    <div
      className="h-56 w-full"
      role="img"
      aria-label="Running points difference against the global gameweek average"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 12, right: 10, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.16} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 5" />
          <XAxis
            dataKey="gameweek"
            tickFormatter={(value) => `GW${value}`}
            axisLine={false}
            tickLine={false}
            minTickGap={20}
          />
          <YAxis
            width={38}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value) => signed(Number(value))}
          />
          <ReferenceLine
            y={0}
            stroke="var(--fg-subtle)"
            strokeDasharray="4 4"
          />
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltip
                active={active}
                label={
                  payload?.[0] ? `Gameweek ${payload[0].payload.gameweek}` : ""
                }
                rows={[
                  {
                    key: "advantage",
                    label: "Running difference",
                    value:
                      payload?.[0]?.value != null
                        ? `${signed(Number(payload[0].value))} pts`
                        : "—",
                    color,
                  },
                ]}
              />
            )}
          />
          <Area
            dataKey="advantage"
            type="monotone"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${id})`}
            isAnimationActive={false}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
