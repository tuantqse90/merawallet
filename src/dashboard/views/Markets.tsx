import { useEffect, useState } from "react";
import type { MarketRow, NtToken } from "../../api/nullterminal";
import { formatPercent, formatUsd } from "../../lib/format";
import { MicroLabel, MintChip, TokenLogo } from "../../shared/ui";
import { getMarketMap, getTokenList } from "../../popup/data";
import { MiniSpark } from "../MiniSpark";

type Row = { token: NtToken; market: MarketRow };

export function Markets() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([getTokenList(), getMarketMap()])
      .then(([tokens, market]) => {
        if (!alive) return;
        const joined = tokens
          .map((token) => ({
            token,
            market: market[token.address.toLowerCase()] ?? {},
          }))
          .filter((r) => (r.market.volume24h ?? 0) > 0)
          .sort((a, b) => (b.market.volume24h ?? 0) - (a.market.volume24h ?? 0))
          .slice(0, 30);
        setRows(joined);
      })
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <MicroLabel>monad markets · top 30 by 24h volume</MicroLabel>
        <a
          href="https://nullterminal.xyz/markets"
          target="_blank"
          rel="noreferrer"
          className="font-mono-num text-[10px] uppercase tracking-wider text-primary hover:underline"
        >
          full markets on nullterminal ↗
        </a>
      </div>
      <div className="glass overflow-hidden rounded-2xl border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left">
              {["#", "token", "price", "24h", "chart", "volume 24h"].map((h) => (
                <th
                  key={h}
                  className={`px-4 py-2.5 font-mono-num text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${
                    h === "price" || h === "24h" || h === "volume 24h" ? "text-right" : h === "chart" ? "text-center" : ""
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows === null &&
              [0, 1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 py-3">
                    <div className="skeleton h-6 w-full" />
                  </td>
                </tr>
              ))}
            {rows?.map((r, i) => (
              <tr key={r.token.address} className="transition-colors hover:bg-foreground/5">
                <td className="font-mono-num px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-2.5">
                  <a
                    href={`https://nullterminal.xyz/token/${r.token.address}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 font-semibold hover:text-primary"
                  >
                    <TokenLogo src={r.token.logoURI} symbol={r.token.symbol} size={26} />
                    {r.token.symbol}
                    {r.token.verified && <MintChip>verified</MintChip>}
                  </a>
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right">
                  {r.market.priceUsd !== undefined ? formatUsd(r.market.priceUsd) : "—"}
                </td>
                <td
                  className={`font-mono-num px-4 py-2.5 text-right ${
                    (r.market.change24h ?? 0) >= 0 ? "text-mint" : "text-danger"
                  }`}
                >
                  {r.market.change24h !== undefined
                    ? formatPercent(r.market.change24h)
                    : "—"}
                </td>
                <td className="px-4 py-1.5 text-center">
                  {i < 10 ? (
                    <MiniSpark address={r.token.address} />
                  ) : (
                    <span className="text-muted-foreground/30">·</span>
                  )}
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right">
                  {r.market.volume24h !== undefined
                    ? formatUsd(r.market.volume24h)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
