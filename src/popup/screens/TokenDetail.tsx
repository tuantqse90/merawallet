import { useEffect, useState } from "react";
import { encodeFunctionData } from "viem";
import { fetchChart } from "../../api/nullterminal";
import type { TokenBalance } from "../../chain/balances";
import { wmonAbi } from "../../chain/erc20";
import { getPublicClient } from "../../chain/monad";
import { sendTransaction } from "../../chain/tx";
import { EXPLORER_URL, NATIVE_MON, WMON } from "../../config";
import { WalletLockedError } from "../../keyring/signer";
import type { AccountRec, Settings } from "../../keyring/storage";
import { formatAmount, formatPercent, formatUsd, parseAmount } from "../../lib/format";
import { openOnboarding } from "../../lib/tabs";
import { Sparkline } from "../../shared/Sparkline";
import { GhostButton, MicroLabel, MintChip, Panel, PrimaryButton, Spinner, TokenLogo } from "../../shared/ui";

export function TokenDetail({
  row,
  account,
  settings,
  onSend,
  onSwap,
  onClose,
}: {
  row: TokenBalance;
  account: AccountRec;
  settings: Settings;
  onSend: () => void;
  onSwap: () => void;
  onClose: () => void;
}) {
  const { token } = row;
  const isNative = token.address.toLowerCase() === NATIVE_MON;
  // Native MON's trades live under WMON in the NullTerminal index.
  const chartAddress = isNative ? WMON : token.address;
  const [closes, setCloses] = useState<number[] | null>(null);
  const [range, setRange] = useState<{ high: number; low: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchChart(chartAddress)
      .then((candles) => {
        if (!alive) return;
        const last24 = candles.slice(-24);
        if (last24.length >= 2) {
          setCloses(last24.map((c) => c.c));
          setRange({
            high: Math.max(...last24.map((c) => c.h)),
            low: Math.min(...last24.map((c) => c.l)),
          });
        } else {
          setCloses([]);
        }
      })
      .catch(() => {
        if (alive) setCloses([]);
      });
    return () => {
      alive = false;
    };
  }, [chartAddress]);
  const explorerHref = isNative
    ? `${EXPLORER_URL}/address/${account.address}`
    : `${EXPLORER_URL}/token/${token.address}`;
  const ntHref = isNative
    ? "https://nullterminal.xyz/markets"
    : `https://nullterminal.xyz/token/${token.address}`;

  return (
    <div className="absolute inset-0 z-20 flex flex-col overflow-y-auto bg-background">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <MicroLabel>{token.symbol}</MicroLabel>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Close
        </button>
      </div>

      <div className="flex flex-col gap-3 px-3 py-4">
        <div className="flex flex-col items-center gap-2 py-2">
          <TokenLogo src={token.logoURI} symbol={token.symbol} size={56} />
          <div className="text-center">
            <div className="font-mono-num text-2xl font-bold tracking-tight">
              {formatAmount(row.balance, token.decimals)}{" "}
              <span className="text-lg text-muted-foreground">{token.symbol}</span>
            </div>
            <div className="font-mono-num text-sm text-muted-foreground">
              {formatUsd(row.valueUsd)}
            </div>
          </div>
          {token.verified && <MintChip>verified</MintChip>}
        </div>

        {closes === null && (
          <div className="skeleton h-[104px] w-full rounded-2xl" />
        )}
        {closes && closes.length >= 2 && (
          <Panel className="space-y-1 !p-2.5">
            <div className="flex items-center justify-between px-1">
              <MicroLabel>24h price</MicroLabel>
              {range && (
                <span className="font-mono-num text-[10px] text-muted-foreground">
                  L {formatUsd(range.low)} · H {formatUsd(range.high)}
                </span>
              )}
            </div>
            <Sparkline values={closes} />
          </Panel>
        )}

        {!token.verified && !isNative && (
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-[11px] leading-relaxed text-warning">
            Unverified token — not on the curated Monad list. Check the contract
            before trading.
          </div>
        )}

        <Panel className="space-y-2">
          <Row label="price" value={row.priceUsd !== undefined ? formatUsd(row.priceUsd) : "—"} />
          <Row
            label="24h change"
            value={row.change24h !== undefined ? formatPercent(row.change24h) : "—"}
            tone={row.change24h !== undefined ? (row.change24h >= 0 ? "mint" : "danger") : undefined}
          />
          <Row label="network" value="Monad · 143" />
          {!isNative && (
            <Row label="contract" value={`${token.address.slice(0, 10)}…`} />
          )}
        </Panel>

        <div className="grid grid-cols-2 gap-2">
          <PrimaryButton onClick={onSend}>Send</PrimaryButton>
          <GhostButton className="justify-center py-3" onClick={onSwap}>
            Swap
          </GhostButton>
        </div>

        {(isNative || token.address.toLowerCase() === WMON.toLowerCase()) && (
          <WrapPanel
            mode={isNative ? "wrap" : "unwrap"}
            row={row}
            account={account}
            settings={settings}
          />
        )}

        <div className="grid grid-cols-2 gap-2">
          <a
            href={explorerHref}
            target="_blank"
            rel="noreferrer"
            className="glass flex items-center justify-center gap-1.5 rounded-xl border border-border/60 px-3 py-2 text-xs font-semibold text-muted-foreground transition-all hover:-translate-y-px hover:border-primary/50 hover:text-foreground"
          >
            MonadScan ↗
          </a>
          <a
            href={ntHref}
            target="_blank"
            rel="noreferrer"
            className="glass flex items-center justify-center gap-1.5 rounded-xl border border-border/60 px-3 py-2 text-xs font-semibold text-muted-foreground transition-all hover:-translate-y-px hover:border-primary/50 hover:text-foreground"
          >
            NullTerminal ↗
          </a>
        </div>
      </div>
    </div>
  );
}

/** One-tap MON ↔ WMON conversion — daily Monad life, one WETH9 call. */
function WrapPanel({
  mode,
  row,
  account,
  settings,
}: {
  mode: "wrap" | "unwrap";
  row: TokenBalance;
  account: AccountRec;
  settings: Settings;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const raw = parseAmount(amount, 18);
  const insufficient = raw !== undefined && raw > row.balance;
  const ready = raw !== undefined && raw > 0n && !insufficient && !busy;

  const setMax = async () => {
    if (mode === "unwrap") {
      setAmount((Number(row.balance) / 1e18).toString());
      return;
    }
    // Native MAX must leave gas behind — Monad charges the LIMIT.
    try {
      const price = await getPublicClient(settings.rpcUrl).getGasPrice();
      const reserve = 60_000n * price * 2n;
      const max = row.balance > reserve ? row.balance - reserve : 0n;
      setAmount((Number(max) / 1e18).toString());
    } catch {
      setAmount((Number(row.balance) / 1e18).toString());
    }
  };

  const submit = async () => {
    if (!ready || raw === undefined) return;
    setBusy(true);
    setError(null);
    try {
      await sendTransaction({
        accountIndex: account.index,
        from: account.address,
        rpcUrl: settings.rpcUrl,
        kind: "swap",
        summary:
          mode === "wrap"
            ? `Wrap ${formatAmount(raw, 18)} MON → WMON`
            : `Unwrap ${formatAmount(raw, 18)} WMON → MON`,
        tx:
          mode === "wrap"
            ? {
                to: WMON,
                value: raw,
                data: encodeFunctionData({ abi: wmonAbi, functionName: "deposit" }),
              }
            : {
                to: WMON,
                data: encodeFunctionData({
                  abi: wmonAbi,
                  functionName: "withdraw",
                  args: [raw],
                }),
              },
      });
      setDone(true);
      setAmount("");
    } catch (err) {
      if (err instanceof WalletLockedError) {
        openOnboarding("unlock");
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <MicroLabel>{mode === "wrap" ? "wrap to wmon" : "unwrap to mon"}</MicroLabel>
        <span className="font-mono-num text-[10px] text-muted-foreground">
          {open ? "−" : "+"}
        </span>
      </button>
      {open && (
        <div className="animate-fade-in space-y-2">
          <div className="flex items-center gap-2">
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="0.0"
              className="font-mono-num w-full min-w-0 rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50 placeholder:text-muted-foreground/40"
            />
            <button
              type="button"
              onClick={setMax}
              className="rounded bg-primary/15 px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-primary"
            >
              max
            </button>
          </div>
          {error && <div className="text-[11px] text-danger">{error}</div>}
          {done && (
            <div className="font-mono-num text-[11px] uppercase tracking-wider text-mint">
              sent — track it in activity
            </div>
          )}
          <GhostButton className="w-full" onClick={submit} disabled={!ready}>
            {busy ? <Spinner /> : null}
            {insufficient
              ? "Insufficient balance"
              : mode === "wrap"
                ? "Wrap MON"
                : "Unwrap WMON"}
          </GhostButton>
        </div>
      )}
    </Panel>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "mint" | "danger";
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={`font-mono-num text-xs font-semibold ${
          tone === "mint" ? "text-mint" : tone === "danger" ? "text-danger" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
