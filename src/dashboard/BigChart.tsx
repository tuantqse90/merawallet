// The hero portfolio chart: area + line with dashed gridlines, y-value labels,
// a pulsing live dot, and a hover crosshair with a value tooltip. Pure SVG.
import { useId, useMemo, useRef, useState } from "react";
import type { PfPoint } from "../api/nullterminal";
import { formatUsd } from "../lib/format";

const W = 880;
const H = 200;
const PAD = { top: 12, right: 64, bottom: 10, left: 8 };

export function BigChart({ points }: { points: PfPoint[] }) {
  const gradientId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const model = useMemo(() => {
    if (points.length < 2) return null;
    const values = points.map((p) => p.v);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || max || 1;
    const iw = W - PAD.left - PAD.right;
    const ih = H - PAD.top - PAD.bottom;
    const xy = points.map((p, i) => ({
      x: PAD.left + (i / (points.length - 1)) * iw,
      y: PAD.top + ih * (1 - (p.v - min) / span),
      p,
    }));
    const line = xy.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    const area = `${line} ${xy[xy.length - 1].x.toFixed(1)},${H - PAD.bottom} ${PAD.left},${H - PAD.bottom}`;
    const up = values[values.length - 1] >= values[0];
    const grid = [0.25, 0.5, 0.75].map((f) => ({
      y: PAD.top + ih * f,
      v: max - span * f,
    }));
    return { xy, line, area, up, min, max, grid };
  }, [points]);

  if (!model) return null;
  const tone = model.up ? "hsl(var(--mint))" : "hsl(var(--danger))";
  const last = model.xy[model.xy.length - 1];
  const active = hover !== null ? model.xy[hover] : null;

  const onMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const fx = ((e.clientX - rect.left) / rect.width) * W;
    const iw = W - PAD.left - PAD.right;
    const idx = Math.round(((fx - PAD.left) / iw) * (model.xy.length - 1));
    setHover(Math.max(0, Math.min(model.xy.length - 1, idx)));
  };

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={tone} stopOpacity="0.24" />
            <stop offset="1" stopColor={tone} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {model.grid.map((g) => (
          <g key={g.y}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={g.y}
              y2={g.y}
              stroke="hsl(var(--border) / 0.5)"
              strokeWidth="1"
              strokeDasharray="3 5"
            />
            <text
              x={W - PAD.right + 8}
              y={g.y + 3}
              style={{ fill: "hsl(var(--muted-foreground) / 0.7)", fontSize: "10px" }}
              className="font-mono-num"
            >
              {formatUsd(g.v)}
            </text>
          </g>
        ))}
        <polygon points={model.area} fill={`url(#${gradientId})`} />
        <polyline
          points={model.line}
          fill="none"
          stroke={tone}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={100}
          style={{
            strokeDasharray: 100,
            animation: "draw-m 0.9s cubic-bezier(0.65, 0, 0.35, 1) both",
          }}
        />
        {active && (
          <>
            <line
              x1={active.x}
              x2={active.x}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="hsl(var(--primary) / 0.5)"
              strokeWidth="1"
            />
            <circle cx={active.x} cy={active.y} r="4" fill={tone} />
          </>
        )}
        {!active && (
          <>
            <circle cx={last.x} cy={last.y} r="7" fill={tone} opacity="0.25">
              <animate attributeName="r" values="4;9;4" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <circle cx={last.x} cy={last.y} r="3.5" fill={tone} />
          </>
        )}
      </svg>
      {active && (
        <div
          className="glass-strong pointer-events-none absolute -top-1 z-10 -translate-x-1/2 rounded-lg px-2.5 py-1.5 text-center"
          style={{ left: `${(active.x / W) * 100}%` }}
        >
          <div className="font-mono-num text-xs font-bold">{formatUsd(active.p.v)}</div>
          <div className="font-mono-num text-[9px] text-muted-foreground">
            {new Date(active.p.t * 1000).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
            })}
          </div>
        </div>
      )}
    </div>
  );
}
