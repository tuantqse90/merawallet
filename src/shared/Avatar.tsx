// Deterministic account identicon: two hues + an angle derived from the address bytes.
// Same address → same gradient everywhere (popup, approval window, account sheet).
export function Avatar({
  address,
  size = 32,
}: {
  address: string;
  size?: number;
}) {
  const seed = Number.parseInt(address.slice(2, 10), 16) || 0;
  const h1 = seed % 360;
  const h2 = (h1 + 80 + ((seed >> 9) % 140)) % 360;
  const angle = (seed >> 18) % 360;
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-full ring-2 ring-border/60"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(${angle}deg, hsl(${h1} 80% 62%), hsl(${h2} 75% 45%))`,
      }}
    />
  );
}
