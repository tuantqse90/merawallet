// Dependency-free SVG price sparkline: line + soft area fill, colored by direction
// (mint up / danger down, NT status tokens). Draws itself on mount via dashoffset.
import { useMemo } from "react";

export function Sparkline({
  values,
  width = 312,
  height = 96,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  const { linePoints, areaPoints, up } = useMemo(() => {
    if (values.length < 2) return { linePoints: "", areaPoints: "", up: true };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || max || 1;
    const pad = 6;
    const stepX = (width - pad * 2) / (values.length - 1);
    const pts = values.map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (height - pad * 2) * (1 - (v - min) / span);
      return [x, y] as const;
    });
    const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const area = `${line} ${(pad + (values.length - 1) * stepX).toFixed(1)},${height - 2} ${pad},${height - 2}`;
    return {
      linePoints: line,
      areaPoints: area,
      up: values[values.length - 1] >= values[0],
    };
  }, [values, width, height]);

  if (!linePoints) return null;
  const tone = up ? "hsl(var(--mint))" : "hsl(var(--danger))";

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      aria-hidden
      className="block"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={tone} stopOpacity="0.22" />
          <stop offset="1" stopColor={tone} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill="url(#spark-fill)" />
      <polyline
        points={linePoints}
        fill="none"
        stroke={tone}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        style={{
          strokeDasharray: 100,
          animation: "draw-m 0.8s cubic-bezier(0.65, 0, 0.35, 1) both",
        }}
      />
      <circle
        cx={linePoints.split(" ").pop()?.split(",")[0]}
        cy={linePoints.split(" ").pop()?.split(",")[1]}
        r="3"
        fill={tone}
        className="animate-fade-in"
        style={{ animationDelay: "0.75s" }}
      />
    </svg>
  );
}
