// Allocation donut: SVG stroke-dasharray segments over a muted track, colored with
// NullTerminal's fixed categorical viz slots. Center shows the holding count.
const VIZ = [1, 2, 3, 4, 5].map((n) => `hsl(var(--viz-${n}))`);

export type DonutSlice = { label: string; value: number };

export function Donut({
  slices,
  size = 168,
}: {
  slices: DonutSlice[];
  size?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;
  const R = 40;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox="0 0 100 100" className="-rotate-90 shrink-0">
        <circle cx="50" cy="50" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="12" />
        {slices.map((slice, i) => {
          const frac = slice.value / total;
          const seg = (
            <circle
              key={slice.label}
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke={VIZ[i % VIZ.length]}
              strokeWidth="12"
              strokeDasharray={`${Math.max(0.5, frac * C - 1.2)} ${C}`}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += frac * C;
          return seg;
        })}
        <g className="rotate-90" style={{ transformOrigin: "50px 50px" }}>
          <text
            x="50"
            y="47"
            textAnchor="middle"
            className="font-mono-num"
            style={{ fill: "hsl(var(--foreground))", fontSize: "13px", fontWeight: 700 }}
          >
            {slices.length}
          </text>
          <text
            x="50"
            y="59"
            textAnchor="middle"
            style={{ fill: "hsl(var(--muted-foreground))", fontSize: "6.5px", letterSpacing: "0.1em" }}
          >
            ASSETS
          </text>
        </g>
      </svg>
      <div className="min-w-0 space-y-1.5">
        {slices.map((slice, i) => (
          <div key={slice.label} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: VIZ[i % VIZ.length] }}
            />
            <span className="truncate text-xs font-semibold">{slice.label}</span>
            <span className="font-mono-num ml-auto pl-3 text-xs text-muted-foreground">
              {((slice.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
