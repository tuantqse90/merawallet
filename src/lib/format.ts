export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Token amount from raw units, trimmed to a sensible precision for the magnitude. */
export function formatAmount(raw: bigint, decimals: number): string {
  const value = Number(raw) / 10 ** decimals;
  if (value === 0) return "0";
  if (value < 0.0001) return value.toExponential(2);
  if (value < 1) return value.toFixed(4).replace(/\.?0+$/, "");
  if (value < 1000) return value.toFixed(4).replace(/\.?0+$/, "");
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function formatUsd(value: number | undefined): string {
  if (value === undefined) return "—";
  if (value > 0 && value < 0.01) return "<$0.01";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function formatPercent(value: number | undefined): string {
  if (value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** Parses a human amount string into raw units; returns undefined when not a number. */
export function parseAmount(input: string, decimals: number): bigint | undefined {
  const trimmed = input.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") {
    return undefined;
  }
  const [whole = "0", frac = ""] = trimmed.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  try {
    return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
  } catch {
    return undefined;
  }
}

export function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
