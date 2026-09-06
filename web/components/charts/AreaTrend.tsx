"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { compactNumber } from "@/lib/format";
import { ChartTooltip } from "./ChartFrame";

type Fmt = "plain" | "money" | "compact";

function fmt(v: number, mode: Fmt): string {
  if (mode === "money") return `£${v.toFixed(1)}m`;
  if (mode === "compact") return compactNumber(v);
  return String(Math.round(v));
}

export function AreaTrend({
  data,
  dataKey,
  xKey = "gameweek",
  label,
  color = "var(--cyan)",
  format = "plain",
  height = 200,
}: {
  data: Record<string, number>[];
  dataKey: string;
  xKey?: string;
  label: string;
  color?: string;
  format?: Fmt;
  height?: number;
}) {
  if (data.length < 2) {
    return <p className="py-8 text-center text-sm text-fg-muted">Not enough data yet.</p>;
  }
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" debounce={0}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`trend-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey={xKey} tickFormatter={(v) => `GW${v}`} axisLine={false} tickLine={false} />
          <YAxis
            width={44}
            domain={["auto", "auto"]}
            tickFormatter={(v) => fmt(Number(v), format)}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltip
                active={active}
                label={payload?.[0] ? `Gameweek ${payload[0].payload[xKey]}` : ""}
                rows={[
                  {
                    key: dataKey,
                    label,
                    value: payload?.[0] ? fmt(Number(payload[0].value), format) : "",
                    color,
                  },
                ]}
              />
            )}
          />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#trend-${dataKey})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
