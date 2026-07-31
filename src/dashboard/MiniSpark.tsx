// Tiny per-row 24h sparkline, lazily fetched from NT's chart endpoint with a
// module-level cache so tab switches and re-renders never refetch.
import { useEffect, useState } from "react";
import { fetchChart } from "../api/nullterminal";
import { NATIVE_MON, WMON } from "../config";

const cache = new Map<string, number[] | null>();

export function MiniSpark({ address }: { address: string }) {
  const key = (address.toLowerCase() === NATIVE_MON ? WMON : address).toLowerCase();
  const [closes, setCloses] = useState<number[] | null | undefined>(cache.get(key));

  useEffect(() => {
    if (cache.has(key)) {
      setCloses(cache.get(key));
      return;
    }
    let alive = true;
    void fetchChart(key)
      .then((candles) => {
        const c = candles.slice(-24).map((x) => x.c);
        const out = c.length >= 2 ? c : null;
        cache.set(key, out);
        if (alive) setCloses(out);
      })
      .catch(() => {
        cache.set(key, null);
        if (alive) setCloses(null);
      });
    return () => {
      alive = false;
    };
  }, [key]);

  if (closes === undefined) return <span className="skeleton inline-block h-6 w-20" />;
  if (closes === null) return <span className="text-muted-foreground/40">—</span>;

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const span = max - min || max || 1;
  const up = closes[closes.length - 1] >= closes[0];
  const tone = up ? "hsl(var(--mint))" : "hsl(var(--danger))";
  const pts = closes
    .map((v, i) => {
      const x = (i / (closes.length - 1)) * 80;
      const y = 2 + 20 * (1 - (v - min) / span);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width="80" height="24" viewBox="0 0 80 24" aria-hidden className="inline-block">
      <polyline
        points={pts}
        fill="none"
        stroke={tone}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}
