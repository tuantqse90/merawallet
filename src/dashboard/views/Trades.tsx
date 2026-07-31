import { useEffect, useState } from "react";
import { fetchTrades, type PfTrade } from "../../api/nullterminal";
import { EXPLORER_URL } from "../../config";
import type { AccountRec } from "../../keyring/storage";
import { formatUsd, shortAddress, timeAgo } from "../../lib/format";
import { MicroLabel, TokenLogo } from "../../shared/ui";
import { getTokenList } from "../../popup/data";

export function Trades({ account }: { account: AccountRec }) {
  const [trades, setTrades] = useState<PfTrade[] | null>(null);
  const [logos, setLogos] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let alive = true;
    void fetchTrades(account.address)
      .then((t) => alive && setTrades(t))
      .catch(() => alive && setTrades([]));
    void getTokenList()
      .then((list) => {
        if (!alive) return;
        const m = new Map<string, string>();
        for (const t of list) {
          if (t.logoURI) m.set(t.address.toLowerCase(), t.logoURI);
        }
        setLogos(m);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [account.address]);

  return (
    <div className="space-y-4">
      <MicroLabel>dex trade tape</MicroLabel>
      <div className="glass overflow-hidden rounded-2xl border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left">
              {["side", "token", "amount", "usd", "age", "tx"].map((h) => (
                <th
                  key={h}
                  className={`px-4 py-2.5 font-mono-num text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${
                    h === "amount" || h === "usd" || h === "age" ? "text-right" : ""
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {trades === null &&
              [0, 1, 2].map((i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 py-3">
                    <div className="skeleton h-6 w-full" />
                  </td>
                </tr>
              ))}
            {trades !== null && trades.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No router swaps for this address in the NullTerminal index yet.
                  Trade through the wallet or nullterminal.xyz and the tape fills in.
                </td>
              </tr>
            )}
            {trades?.map((t) => (
              <tr key={`${t.tx}-${t.token}-${t.side}`} className="transition-colors hover:bg-foreground/5">
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono-num text-[10px] uppercase tracking-wider ${
                      t.side === "buy"
                        ? "border-mint/40 bg-mint/10 text-mint"
                        : "border-danger/40 bg-danger/10 text-danger"
                    }`}
                  >
                    {t.side}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2 font-semibold">
                    <TokenLogo
                      src={logos.get(t.token.toLowerCase())}
                      symbol={t.symbol}
                      size={22}
                    />
                    {t.symbol}
                  </span>
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right">
                  {t.tokenAmt.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right font-semibold">
                  {formatUsd(t.usd)}
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right text-muted-foreground">
                  {timeAgo(t.t * 1000)}
                </td>
                <td className="px-4 py-2.5">
                  <a
                    href={`${EXPLORER_URL}/tx/${t.tx}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono-num text-xs text-primary hover:underline"
                  >
                    {shortAddress(t.tx)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
