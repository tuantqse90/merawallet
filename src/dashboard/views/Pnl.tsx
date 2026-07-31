import { useEffect, useState } from "react";
import {
  fetchPnl,
  fetchPnlCalendar,
  type PnlDay,
  type WalletPnl,
} from "../../api/nullterminal";
import type { AccountRec } from "../../keyring/storage";
import { formatPercent, formatUsd } from "../../lib/format";
import { MicroLabel, Panel, TokenLogo } from "../../shared/ui";

export function Pnl({ account }: { account: AccountRec }) {
  const [pnl, setPnl] = useState<WalletPnl | null>(null);
  const [days, setDays] = useState<PnlDay[] | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchPnl(account.address)
      .then((p) => alive && setPnl(p))
      .catch(() => {});
    void fetchPnlCalendar(account.address)
      .then((c) => alive && setDays(c.days ?? []))
      .catch(() => alive && setDays([]));
    return () => {
      alive = false;
    };
  }, [account.address]);

  const traded = pnl?.tokens.filter((t) => t.totalUsd !== 0 || t.curValue > 0) ?? [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        {(
          [
            ["total", pnl?.total],
            ["realized", pnl?.realized],
            ["unrealized", pnl?.unrealized],
          ] as const
        ).map(([label, value]) => (
          <Panel key={label} className="!p-4">
            <MicroLabel>{label}</MicroLabel>
            <div
              className={`font-mono-num mt-1 text-2xl font-bold ${
                value === undefined
                  ? "text-muted-foreground"
                  : value >= 0
                    ? "text-mint"
                    : "text-danger"
              }`}
            >
              {value === undefined ? "…" : `${value >= 0 ? "+" : ""}${formatUsd(value)}`}
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="!p-5">
        <MicroLabel className="mb-3">realized pnl calendar</MicroLabel>
        {days === null ? (
          <div className="skeleton h-24 w-full" />
        ) : (
          <Heatmap days={days} />
        )}
      </Panel>

      <div className="glass overflow-hidden rounded-2xl border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left">
              {["token", "avg cost", "realized", "unrealized", "total", "roi"].map((h) => (
                <th
                  key={h}
                  className={`px-4 py-2.5 font-mono-num text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ${
                    h !== "token" ? "text-right" : ""
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {pnl === null && (
              <tr>
                <td colSpan={6} className="px-4 py-3">
                  <div className="skeleton h-6 w-full" />
                </td>
              </tr>
            )}
            {pnl !== null && traded.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  PnL tracks DEX trades on Monad. Swap something and it starts counting.
                </td>
              </tr>
            )}
            {traded.map((t) => (
              <tr key={t.token} className="transition-colors hover:bg-foreground/5">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2.5 font-semibold">
                    <TokenLogo src={t.logo ?? undefined} symbol={t.symbol} size={24} />
                    {t.symbol}
                  </span>
                </td>
                <td className="font-mono-num px-4 py-2.5 text-right">{formatUsd(t.avgCost)}</td>
                <PnlCell value={t.realizedUsd} />
                <PnlCell value={t.unrealizedUsd} />
                <PnlCell value={t.totalUsd} bold />
                <td
                  className={`font-mono-num px-4 py-2.5 text-right ${
                    (t.roiPct ?? 0) >= 0 ? "text-mint" : "text-danger"
                  }`}
                >
                  {t.roiPct !== null ? formatPercent(t.roiPct) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-center font-mono-num text-[9px] uppercase tracking-wider text-muted-foreground/60">
        average-cost basis over the full dex_trades index · powered by nullterminal
      </p>
    </div>
  );
}

function PnlCell({ value, bold }: { value: number; bold?: boolean }) {
  return (
    <td
      className={`font-mono-num px-4 py-2.5 text-right ${bold ? "font-semibold" : ""} ${
        value >= 0 ? "text-mint" : "text-danger"
      }`}
    >
      {value >= 0 ? "+" : ""}
      {formatUsd(value)}
    </td>
  );
}

/** GitHub-style calendar: last 16 weeks of UTC days, mint = green day, danger = red. */
function Heatmap({ days }: { days: PnlDay[] }) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const maxAbs = Math.max(1, ...days.map((d) => Math.abs(d.realizedUsd)));
  const WEEKS = 16;
  const today = new Date();
  const cells: { date: string; day?: PnlDay }[][] = [];
  for (let w = WEEKS - 1; w >= 0; w--) {
    const col: { date: string; day?: PnlDay }[] = [];
    for (let d = 6; d >= 0; d--) {
      const dt = new Date(today.getTime() - (w * 7 + d) * 86_400_000);
      const key = dt.toISOString().slice(0, 10);
      col.push({ date: key, day: byDate.get(key) });
    }
    cells.push(col);
  }
  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {cells.map((col, i) => (
        <div key={i} className="flex flex-col gap-1">
          {col.map((cell) => {
            const v = cell.day?.realizedUsd ?? 0;
            const intensity = Math.min(1, Math.abs(v) / maxAbs);
            const bg =
              v === 0
                ? "hsl(var(--muted))"
                : v > 0
                  ? `hsl(var(--mint) / ${0.25 + intensity * 0.75})`
                  : `hsl(var(--danger) / ${0.25 + intensity * 0.75})`;
            return (
              <span
                key={cell.date}
                title={`${cell.date}${cell.day ? ` · ${v >= 0 ? "+" : ""}${formatUsd(v)} · ${cell.day.trades} trades` : ""}`}
                className="h-3 w-3 rounded-[3px]"
                style={{ background: bg }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
