import { useEffect, useState } from "react";
import { fetchPnl, type WalletPnl } from "../../api/nullterminal";
import type { TokenBalance } from "../../chain/balances";
import { setLocal, type AccountRec, type Settings } from "../../keyring/storage";
import { formatAmount, formatPercent, formatUsd, shortAddress } from "../../lib/format";
import { useCountUp } from "../../lib/useCountUp";
import { Avatar } from "../../shared/Avatar";
import { ErrorBanner, MicroLabel, TokenLogo } from "../../shared/ui";
import { usePortfolio } from "../data";

const MASK = "•••••";

const pnlCache = new Map<string, { data: WalletPnl; at: number }>();

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
  const [hidden, setHidden] = useState(!!settings.hideBalances);
  const copyAddress = async () => {
    await navigator.clipboard.writeText(account.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };
  const toggleHidden = () => {
    const next = !hidden;
    setHidden(next);
    void setLocal({ settings: { ...settings, hideBalances: next } });
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
  const animatedTotal = useCountUp(rows ? total : undefined);
  const [view, setView] = useState<"tokens" | "pnl">("tokens");
  const [pnl, setPnl] = useState<WalletPnl | null>(null);
  const [pnlError, setPnlError] = useState(false);

  useEffect(() => {
    if (view !== "pnl") return;
    const cached = pnlCache.get(account.address);
    if (cached && Date.now() - cached.at < 60_000) {
      setPnl(cached.data);
      return;
    }
    let alive = true;
    setPnl(null);
    setPnlError(false);
    void fetchPnl(account.address)
      .then((data) => {
        pnlCache.set(account.address, { data, at: Date.now() });
        if (alive) setPnl(data);
      })
      .catch(() => {
        if (alive) setPnlError(true);
      });
    return () => {
      alive = false;
    };
  }, [view, account.address]);

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
        <div className="mb-1 flex items-center gap-2">
          <MicroLabel>total balance</MicroLabel>
          <button
            type="button"
            onClick={toggleHidden}
            title={hidden ? "Show balances" : "Hide balances"}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {hidden ? (
                <path d="M3 3l18 18M10.5 5.2A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7-.4 1-1.4 2.5-2.9 3.8M6.6 6.6C4.2 8 2.6 10.2 2 12c1 2.5 5 7 10 7 1.5 0 2.9-.4 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
              ) : (
                <>
                  <path d="M2 12c1-2.5 5-7 10-7s9 4.5 10 7c-1 2.5-5 7-10 7S3 14.5 2 12Z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </div>
        <div className="flex items-end justify-between gap-2">
          <span className="flex items-baseline gap-2">
            <span className="font-mono-num text-3xl font-bold tracking-tight">
              {hidden ? MASK : rows ? formatUsd(animatedTotal ?? total) : "…"}
            </span>
            {!hidden && change24h !== undefined && (
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

      <div className="glass flex items-center gap-1 self-start rounded-2xl border border-border/60 p-1">
        {(["tokens", "pnl"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-xl px-3 py-1 font-mono-num text-[10px] uppercase tracking-wider transition-all duration-200 ${
              view === v
                ? "bg-primary/20 text-foreground shadow-glow-primary"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "pnl" && (
        <PnlView pnl={pnl} error={pnlError} hidden={hidden} />
      )}

      {view === "tokens" && (
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
                  {hidden ? MASK : formatAmount(row.balance, row.token.decimals)}
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
                  {hidden ? MASK : formatUsd(row.valueUsd)}
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
      )}
    </div>
  );
}

function PnlView({
  pnl,
  error,
  hidden,
}: {
  pnl: WalletPnl | null;
  error: boolean;
  hidden: boolean;
}) {
  if (error) {
    return (
      <div className="glass rounded-2xl border border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
        PnL is unavailable right now — try again in a moment.
      </div>
    );
  }
  if (!pnl) {
    return <div className="skeleton h-40 w-full rounded-2xl" />;
  }
  const mask = (v: number) => (hidden ? MASK : formatUsd(v));
  const traded = pnl.tokens.filter((t) => t.totalUsd !== 0 || t.curValue > 0);
  return (
    <div className="animate-fade-in space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["total", pnl.total],
            ["realized", pnl.realized],
            ["unrealized", pnl.unrealized],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="glass rounded-2xl border border-border/60 p-2.5">
            <div className="font-mono-num text-[9px] uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div
              className={`font-mono-num mt-0.5 text-sm font-bold ${
                value >= 0 ? "text-mint" : "text-danger"
              }`}
            >
              {value >= 0 && !hidden ? "+" : ""}
              {mask(value)}
            </div>
          </div>
        ))}
      </div>
      {traded.length === 0 ? (
        <div className="glass rounded-2xl border border-border/60 px-4 py-6 text-center text-sm text-muted-foreground">
          PnL tracks your DEX trades on Monad. Make a swap and it starts
          counting.
        </div>
      ) : (
        <div className="glass divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60">
          {traded.slice(0, 20).map((t) => (
            <div key={t.token} className="flex items-center gap-3 px-3.5 py-2.5">
              <TokenLogo src={t.logo ?? undefined} symbol={t.symbol} size={30} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{t.symbol}</span>
                  <span
                    className={`font-mono-num text-sm font-semibold ${
                      t.totalUsd >= 0 ? "text-mint" : "text-danger"
                    }`}
                  >
                    {t.totalUsd >= 0 && !hidden ? "+" : ""}
                    {mask(t.totalUsd)}
                  </span>
                </span>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-mono-num text-[11px] text-muted-foreground">
                    avg {formatUsd(t.avgCost)}
                  </span>
                  {t.roiPct !== null && (
                    <span
                      className={`font-mono-num text-[11px] ${
                        t.roiPct >= 0 ? "text-mint" : "text-danger"
                      }`}
                    >
                      {formatPercent(t.roiPct)}
                    </span>
                  )}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="text-center font-mono-num text-[9px] uppercase tracking-wider text-muted-foreground/60">
        average-cost basis · powered by nullterminal
      </p>
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
