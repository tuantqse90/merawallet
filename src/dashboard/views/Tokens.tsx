import type { AccountRec, Settings } from "../../keyring/storage";
import { formatAmount, formatPercent, formatUsd } from "../../lib/format";
import { MicroLabel, TokenLogo } from "../../shared/ui";
import { usePortfolio } from "../../popup/data";
import { MiniSpark } from "../MiniSpark";

export function Tokens({
  account,
  settings,
}: {
  account: AccountRec;
  settings: Settings;
}) {
  const { rows } = usePortfolio(account.address, settings.rpcUrl);

  return (
    <div className="space-y-4">
      <MicroLabel>holdings</MicroLabel>
      <div className="glass overflow-hidden rounded-2xl border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left">
              {["token", "price", "24h", "chart", "balance", "value"].map((h) => (
                <th
                  key={h}
                  className={`px-4 py-2.5 font-mono-num text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${
                    h === "token" ? "" : h === "chart" ? "text-center" : "text-right"
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows === null &&
              [0, 1, 2, 3].map((i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-4 py-3">
                    <div className="skeleton h-6 w-full" />
                  </td>
                </tr>
              ))}
            {rows?.map((row, i) => (
              <tr
                key={row.token.address}
                className="transition-colors hover:bg-foreground/5"
              >
                <td className="px-4 py-2.5">
                  <a
                    href={
                      row.token.address.startsWith("0x0000")
                        ? "https://nullterminal.xyz/markets"
                        : `https://nullterminal.xyz/token/${row.token.address}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2.5 font-semibold hover:text-primary"
                  >
                    <TokenLogo src={row.token.logoURI} symbol={row.token.symbol} size={26} />
                    {row.token.symbol}
                    <span className="hidden max-w-40 truncate text-xs font-normal text-muted-foreground md:inline">
                      {row.token.name}
                    </span>
                  </a>
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right">
                  {row.priceUsd !== undefined ? formatUsd(row.priceUsd) : "—"}
                </td>
                <td
                  className={`font-mono-num px-4 py-2.5 text-right ${
                    (row.change24h ?? 0) >= 0 ? "text-mint" : "text-danger"
                  }`}
                >
                  {row.change24h !== undefined ? formatPercent(row.change24h) : "—"}
                </td>
                <td className="px-4 py-1.5 text-center">
                  {i < 8 ? (
                    <MiniSpark address={row.token.address} />
                  ) : (
                    <span className="text-muted-foreground/30">·</span>
                  )}
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right">
                  {formatAmount(row.balance, row.token.decimals)}
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right font-semibold">
                  {formatUsd(row.valueUsd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
