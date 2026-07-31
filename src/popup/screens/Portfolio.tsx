import { useState } from "react";
import type { TokenBalance } from "../../chain/balances";
import type { AccountRec, Settings } from "../../keyring/storage";
import { formatAmount, formatPercent, formatUsd, shortAddress } from "../../lib/format";
import { Avatar } from "../../shared/Avatar";
import { ErrorBanner, MicroLabel, TokenLogo } from "../../shared/ui";
import { usePortfolio } from "../data";

export function Portfolio({
  account,
  settings,
  onSend,
  onReceive,
  onSwap,
  onAccounts,
  onDetail,
}: {
  account: AccountRec;
  settings: Settings;
  onSend: (tokenAddress?: string) => void;
  onReceive: () => void;
  onSwap: () => void;
  onAccounts: () => void;
  onDetail: (row: TokenBalance) => void;
}) {
  const { rows, loading, error, refresh } = usePortfolio(
    account.address,
    settings.rpcUrl,
  );
  const [copied, setCopied] = useState(false);
  const copyAddress = async () => {
    await navigator.clipboard.writeText(account.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  const total = rows?.reduce((sum, r) => sum + (r.valueUsd ?? 0), 0);
  // 24h move of the priced part of the portfolio, value-weighted.
  const pricedTotal =
    rows?.reduce(
      (sum, r) => sum + (r.change24h !== undefined ? (r.valueUsd ?? 0) : 0),
      0,
    ) ?? 0;
  const change24h =
    rows && pricedTotal > 0
      ? rows.reduce(
          (sum, r) =>
            sum +
            (r.change24h !== undefined ? (r.valueUsd ?? 0) * r.change24h : 0),
          0,
        ) / pricedTotal
      : undefined;

  return (
    <div className="flex flex-col gap-4 px-3 pb-4 pt-4">
      <div className="flex items-start justify-between px-1">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onAccounts}
            className="group flex items-center gap-2.5 text-left"
            title="Switch account"
          >
            <Avatar address={account.address} size={36} />
            <span className="flex items-center gap-1 text-sm font-semibold">
              {account.label}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="text-muted-foreground transition-transform group-hover:translate-y-0.5" aria-hidden>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </button>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-2.5 py-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-mint" />
          </span>
          <span className="font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground">
            monad
          </span>
        </span>
      </div>
      <button
        type="button"
        onClick={copyAddress}
        className="-mt-2 flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 font-mono-num text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        title="Copy address"
      >
        {copied ? (
          <span className="text-mint">copied ✓</span>
        ) : (
          shortAddress(account.address)
        )}
      </button>
      <div className="px-1">
        <MicroLabel className="mb-1">total balance</MicroLabel>
        <div className="flex items-end justify-between gap-2">
          <span className="flex items-baseline gap-2">
            <span className="font-mono-num text-3xl font-bold tracking-tight">
              {rows ? formatUsd(total) : "…"}
            </span>
            {change24h !== undefined && (
              <span
                className={`font-mono-num text-[11px] font-semibold ${
                  change24h >= 0 ? "text-mint" : "text-danger"
                }`}
              >
                {formatPercent(change24h)} 24h
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={refresh}
            className={`mb-1 font-mono-num text-[10px] uppercase tracking-wider transition-colors ${
              loading
                ? "animate-pulse text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {loading ? "syncing" : "refresh"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ActionButton label="Send" onClick={() => onSend()} d="M12 19V5m0 0-6 6m6-6 6 6" />
        <ActionButton label="Receive" onClick={onReceive} d="M12 5v14m0 0-6-6m6 6 6-6" />
        <ActionButton label="Swap" onClick={onSwap} d="M7 4v12m0 0-3-3m3 3 3-3m7 3V4m0 0-3 3m3-3 3 3" />
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="glass divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60">
        {!rows &&
          [0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-3.5 py-3">
              <span className="skeleton h-[34px] w-[34px] shrink-0 rounded-full" />
              <span className="min-w-0 flex-1 space-y-1.5">
                <span className="flex justify-between gap-2">
                  <span className="skeleton h-3.5 w-16" />
                  <span className="skeleton h-3.5 w-20" />
                </span>
                <span className="flex justify-between gap-2">
                  <span className="skeleton h-2.5 w-10" />
                  <span className="skeleton h-2.5 w-14" />
                </span>
              </span>
            </div>
          ))}
        {rows?.map((row) => (
          <button
            key={row.token.address}
            type="button"
            onClick={() => onDetail(row)}
            className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-foreground/5"
          >
            <TokenLogo src={row.token.logoURI} symbol={row.token.symbol} size={34} />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-semibold">
                  {row.token.symbol}
                </span>
                <span className="font-mono-num text-sm font-semibold">
                  {formatAmount(row.balance, row.token.decimals)}
                </span>
              </span>
              <span className="flex items-baseline justify-between gap-2">
                <span
                  className={`font-mono-num text-[11px] ${
                    (row.change24h ?? 0) >= 0 ? "text-mint" : "text-danger"
                  }`}
                >
                  {row.change24h !== undefined ? formatPercent(row.change24h) : ""}
                </span>
                <span className="font-mono-num text-[11px] text-muted-foreground">
                  {formatUsd(row.valueUsd)}
                </span>
              </span>
            </span>
          </button>
        ))}
        {rows && rows.length === 1 && rows[0].balance === 0n && (
          <div className="px-4 py-5 text-center text-sm text-muted-foreground">
            No funds yet. Hit{" "}
            <button
              type="button"
              onClick={onReceive}
              className="font-semibold text-primary hover:underline"
            >
              Receive
            </button>{" "}
            to grab your address.
          </div>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  d,
  onClick,
}: {
  label: string;
  d: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass flex flex-col items-center gap-1 rounded-xl border border-border/60 py-2.5 text-xs font-semibold transition-all duration-200 hover:-translate-y-px hover:border-primary/50 hover:shadow-glow-primary"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary"
        aria-hidden
      >
        <path d={d} />
      </svg>
      {label}
    </button>
  );
}
