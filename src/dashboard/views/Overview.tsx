import { useEffect, useState } from "react";
import {
  fetchHistory,
  fetchPnl,
  fetchTrades,
  type PfPoint,
  type PfTrade,
  type WalletPnl,
} from "../../api/nullterminal";
import type { AccountRec, Settings } from "../../keyring/storage";
import { formatUsd, timeAgo } from "../../lib/format";
import { useCountUp } from "../../lib/useCountUp";
import { Sparkline } from "../../shared/Sparkline";
import { MicroLabel, Panel } from "../../shared/ui";
import { usePortfolio } from "../../popup/data";
import { Donut } from "../Donut";
import type { View } from "../App";

export function Overview({
  account,
  settings,
  goto,
}: {
  account: AccountRec;
  settings: Settings;
  goto: (v: View) => void;
}) {
  const { rows } = usePortfolio(account.address, settings.rpcUrl);
  const [history, setHistory] = useState<PfPoint[] | null>(null);
  const [pnl, setPnl] = useState<WalletPnl | null>(null);
  const [trades, setTrades] = useState<PfTrade[] | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchHistory(account.address)
      .then((h) => alive && setHistory(h.points ?? []))
      .catch(() => alive && setHistory([]));
    void fetchPnl(account.address)
      .then((p) => alive && setPnl(p))
      .catch(() => {});
    void fetchTrades(account.address)
      .then((t) => alive && setTrades(t))
      .catch(() => alive && setTrades([]));
    return () => {
      alive = false;
    };
  }, [account.address]);

  const total = rows?.reduce((s, r) => s + (r.valueUsd ?? 0), 0);
  const animated = useCountUp(rows ? total : undefined);
  const values = history?.map((p) => p.v) ?? [];
  const hi = values.length ? Math.max(...values) : undefined;
  const lo = values.length ? Math.min(...values) : undefined;

  const slices = (rows ?? [])
    .filter((r) => (r.valueUsd ?? 0) > 0)
    .slice(0, 5)
    .map((r) => ({ label: r.token.symbol, value: r.valueUsd ?? 0 }));
  const other =
    (total ?? 0) - slices.reduce((s, x) => s + x.value, 0);
  if (other > 0.01) slices.push({ label: "Other", value: other });

  return (
    <div className="space-y-5">
      <div>
        <MicroLabel className="mb-1">portfolio value</MicroLabel>
        <div className="font-mono-num text-4xl font-bold tracking-tight">
          {rows ? formatUsd(animated ?? total) : "…"}
        </div>
      </div>

      <Panel className="!p-4">
        <div className="mb-2 flex items-center justify-between">
          <MicroLabel>value over time</MicroLabel>
          {hi !== undefined && lo !== undefined && (
            <span className="font-mono-num text-[10px] text-muted-foreground">
              L {formatUsd(lo)} · H {formatUsd(hi)}
            </span>
          )}
        </div>
        {history === null ? (
          <div className="skeleton h-44 w-full" />
        ) : values.length >= 2 ? (
          <div className="h-44">
            <Sparkline values={values} width={880} height={176} />
          </div>
        ) : (
          <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
            Value history builds as the NullTerminal index sees this address.
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-3 gap-4">
        {(
          [
            ["pnl total", pnl?.total],
            ["realized", pnl?.realized],
            ["unrealized", pnl?.unrealized],
          ] as const
        ).map(([label, value]) => (
          <button
            key={label}
            type="button"
            onClick={() => goto("pnl")}
            className="glass rounded-2xl border border-border/60 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40"
          >
            <MicroLabel>{label}</MicroLabel>
            <div
              className={`font-mono-num mt-1 text-xl font-bold ${
                value === undefined
                  ? "text-muted-foreground"
                  : value >= 0
                    ? "text-mint"
                    : "text-danger"
              }`}
            >
              {value === undefined ? "…" : `${value >= 0 ? "+" : ""}${formatUsd(value)}`}
            </div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="!p-5">
          <MicroLabel className="mb-4">allocation</MicroLabel>
          {rows === null ? (
            <div className="skeleton h-40 w-full" />
          ) : slices.length ? (
            <Donut slices={slices} />
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              Fund the wallet to see your allocation.
            </div>
          )}
        </Panel>

        <Panel className="!p-5">
          <div className="mb-3 flex items-center justify-between">
            <MicroLabel>recent trades</MicroLabel>
            <button
              type="button"
              onClick={() => goto("trades")}
              className="font-mono-num text-[10px] uppercase tracking-wider text-primary hover:underline"
            >
              view all
            </button>
          </div>
          {trades === null ? (
            <div className="skeleton h-40 w-full" />
          ) : trades.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">
              No router swaps found for this address yet.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {trades.slice(0, 5).map((t) => (
                <div key={`${t.tx}-${t.token}`} className="flex items-center gap-3 py-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono-num text-[10px] uppercase tracking-wider ${
                      t.side === "buy"
                        ? "border-mint/40 bg-mint/10 text-mint"
                        : "border-danger/40 bg-danger/10 text-danger"
                    }`}
                  >
                    {t.side}
                  </span>
                  <span className="text-sm font-semibold">{t.symbol}</span>
                  <span className="font-mono-num ml-auto text-sm">{formatUsd(t.usd)}</span>
                  <span className="font-mono-num w-16 text-right text-[11px] text-muted-foreground">
                    {timeAgo(t.t * 1000)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
