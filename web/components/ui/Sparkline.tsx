/**
 * Tiny inline SVG sparkline. Server-safe (pure SVG, no JS).
 */
export function Sparkline({
  data,
  width = 72,
  height = 22,
  stroke = "var(--accent)",
  fill = true,
  strokeWidth = 1.5,
  className = "",
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: boolean;
  strokeWidth?: number;
  className?: string;
}) {
  if (!data || data.length === 0) {
    return <svg width={width} height={height} className={className} aria-hidden />;
  }
  if (data.length === 1) data = [data[0], data[0]];

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pad = strokeWidth + 1;
  const stepX = (width - pad * 2) / (data.length - 1);

  const points = data.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / span);
    return [x, y] as const;
  });

  const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(1)},${height} L${points[0][0].toFixed(1)},${height} Z`;
  const gid = `spark-${Math.round(points[0][1] * 1000) + data.length}`;

  return (
    <svg width={width} height={height} className={className} aria-hidden>
      {fill && (
        <>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} />
        </>
      )}
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r={strokeWidth + 0.5} fill={stroke} />
    </svg>
  );
}
