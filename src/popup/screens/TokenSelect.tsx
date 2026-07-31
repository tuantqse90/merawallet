// Full-popup token picker overlay (NT modal idiom, sized for 360×600).
import { useMemo, useState } from "react";
import type { NtToken } from "../../api/nullterminal";
import type { TokenBalance } from "../../chain/balances";
import { formatAmount } from "../../lib/format";
import { MintChip, TokenLogo } from "../../shared/ui";

export function TokenSelect({
  tokens,
  balances,
  onPick,
  onClose,
}: {
  tokens: NtToken[];
  balances?: TokenBalance[] | null;
  onPick: (token: NtToken) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  const balanceOf = useMemo(() => {
    const map = new Map<string, TokenBalance>();
    for (const b of balances ?? []) map.set(b.token.address.toLowerCase(), b);
    return map;
  }, [balances]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? tokens.filter(
          (t) =>
            t.symbol.toLowerCase().includes(q) ||
            t.name.toLowerCase().includes(q) ||
            t.address.toLowerCase() === q,
        )
      : tokens;
    // Held tokens first, then verified, then by liquidity.
    return [...filtered].sort((a, b) => {
      const ha = balanceOf.has(a.address.toLowerCase()) ? 1 : 0;
      const hb = balanceOf.has(b.address.toLowerCase()) ? 1 : 0;
      if (ha !== hb) return hb - ha;
      const va = a.verified ? 1 : 0;
      const vb = b.verified ? 1 : 0;
      if (va !== vb) return vb - va;
      return (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0);
    });
  }, [tokens, query, balanceOf]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-background/70 backdrop-blur-sm">
      <div className="glass-strong gradient-ring animate-modal-in mx-2 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
        <div className="flex items-center gap-2 border-b border-border/60 p-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search symbol, name, address"
            className="font-mono-num w-full rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border/60 px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Esc
          </button>
        </div>
        <div className="min-h-0 flex-1 divide-y divide-border/40 overflow-y-auto">
          {list.map((token) => {
            const held = balanceOf.get(token.address.toLowerCase());
            return (
              <button
                key={token.address}
                type="button"
                onClick={() => onPick(token)}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-foreground/5"
              >
                <TokenLogo src={token.logoURI} symbol={token.symbol} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold">{token.symbol}</span>
                    {token.verified && <MintChip>verified</MintChip>}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {token.name}
                  </span>
                </span>
                {held && (
                  <span className="font-mono-num text-xs text-muted-foreground">
                    {formatAmount(held.balance, token.decimals)}
                  </span>
                )}
              </button>
            );
          })}
          {list.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Nothing matches.
            </div>
          )}
        </div>
      </div>
      <div className="h-2 shrink-0" />
    </div>
  );
}
