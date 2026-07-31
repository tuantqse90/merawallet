// Popup Markets tab — the NullTerminal markets screen, wallet-sized: live Monad
// tokens by 24h volume with search, per-row sparklines, and tap-through to the
// token detail (chart + swap).
import { useEffect, useMemo, useState } from "react";
import type { MarketRow, NtToken } from "../../api/nullterminal";
import type { TokenBalance } from "../../chain/balances";
import { formatPercent, formatUsd } from "../../lib/format";
import { MicroLabel, MintChip, TokenLogo } from "../../shared/ui";
import { MiniSpark } from "../../dashboard/MiniSpark";
import { getMarketMap, getTokenList } from "../data";

type Row = { token: NtToken; market: MarketRow };

export function Markets({
  onDetail,
}: {
  onDetail: (row: TokenBalance) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [query, setQuery] = useState("");

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
          .filter((r) => (r.market.volume24h ?? 0) > 0 || r.market.priceUsd !== undefined)
          .sort((a, b) => (b.market.volume24h ?? 0) - (a.market.volume24h ?? 0));
        setRows(joined);
      })
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
  }, []);

  const list = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.token.symbol.toLowerCase().includes(q) ||
            r.token.name.toLowerCase().includes(q),
        )
      : rows;
    return filtered.slice(0, 40);
  }, [rows, query]);

  return (
    <div className="flex flex-col gap-3 px-3 pb-4 pt-4">
      <div className="flex items-center justify-between px-1">
        <MicroLabel>monad markets</MicroLabel>
        <MintChip>24h volume</MintChip>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tokens"
        className="font-mono-num w-full rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 placeholder:text-muted-foreground/40"
      />

      <div className="glass divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60">
        {list === null &&
          [0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3.5 py-3">
              <span className="skeleton h-[30px] w-[30px] shrink-0 rounded-full" />
              <span className="min-w-0 flex-1 space-y-1.5">
                <span className="skeleton block h-3.5 w-24" />
                <span className="skeleton block h-2.5 w-16" />
              </span>
              <span className="skeleton h-6 w-16" />
            </div>
          ))}
        {list?.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing matches.
          </div>
        )}
        {list?.map((r, i) => (
          <button
            key={r.token.address}
            type="button"
            onClick={() =>
              onDetail({
                token: r.token,
                balance: 0n,
                priceUsd: r.market.priceUsd,
                change24h: r.market.change24h,
                valueUsd: 0,
              })
            }
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-foreground/5"
          >
            <TokenLogo src={r.token.logoURI} symbol={r.token.symbol} size={30} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">
                  {r.token.symbol}
                </span>
                {r.token.verified && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint" title="Verified" />
                )}
              </span>
              <span className="font-mono-num block text-[10px] text-muted-foreground">
                {r.market.volume24h !== undefined
                  ? `vol ${formatUsd(r.market.volume24h)}`
                  : r.token.name}
              </span>
            </span>
            {i < 8 && !query && (
              <span className="shrink-0">
                <MiniSpark address={r.token.address} />
              </span>
            )}
            <span className="w-[76px] shrink-0 text-right">
              <span className="font-mono-num block text-sm font-semibold">
                {r.market.priceUsd !== undefined ? formatUsd(r.market.priceUsd) : "—"}
              </span>
              <span
                className={`font-mono-num text-[11px] ${
                  (r.market.change24h ?? 0) >= 0 ? "text-mint" : "text-danger"
                }`}
              >
                {r.market.change24h !== undefined
                  ? formatPercent(r.market.change24h)
                  : ""}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="text-center font-mono-num text-[9px] uppercase tracking-wider text-muted-foreground/60">
        prices &amp; volume · nullterminal index
      </p>
    </div>
  );
}
