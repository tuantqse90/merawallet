// Swap through the NullTerminal aggregator. The engine is the source of truth:
// this screen renders the quote it returns and signs the transaction it builds —
// no client-side DEX logic, ever.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildSwapTx,
  fetchQuote,
  type NtToken,
  type QuoteResponse,
} from "../../api/nullterminal";
import {
  encodeErc20Approve,
  readAllowance,
  sendTransaction,
  trackReceipt,
} from "../../chain/tx";
import { NATIVE_MON, NULL_ROUTER, QUOTE_REFRESH_MS, USDC } from "../../config";
import type { AccountRec, Settings } from "../../keyring/storage";
import { WalletLockedError } from "../../keyring/signer";
import { formatAmount, parseAmount } from "../../lib/format";
import { openOnboarding } from "../../lib/tabs";
import {
  ErrorBanner,
  MicroLabel,
  MintChip,
  PrimaryButton,
  Spinner,
  TokenLogo,
} from "../../shared/ui";
import { getTokenList, usePortfolio } from "../data";
import { TokenSelect } from "./TokenSelect";

type Side = "in" | "out";

export function Swap({
  account,
  settings,
}: {
  account: AccountRec;
  settings: Settings;
}) {
  const { rows, refresh } = usePortfolio(account.address, settings.rpcUrl);
  const [tokens, setTokens] = useState<NtToken[] | null>(null);
  const [tokenIn, setTokenIn] = useState<NtToken | null>(null);
  const [tokenOut, setTokenOut] = useState<NtToken | null>(null);
  const [picking, setPicking] = useState<Side | null>(null);
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteAt, setQuoteAt] = useState(0);
  const [rateFlipped, setRateFlipped] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [allowance, setAllowance] = useState<bigint | null>(null);
  const [busy, setBusy] = useState<"approve" | "swap" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [doneHash, setDoneHash] = useState<`0x${string}` | null>(null);
  const quoteSeq = useRef(0);

  useEffect(() => {
    void getTokenList().then((list) => {
      setTokens(list);
      setTokenIn(
        list.find((t) => t.address.toLowerCase() === NATIVE_MON) ?? list[0],
      );
      setTokenOut(
        list.find((t) => t.address.toLowerCase() === USDC.toLowerCase()) ??
          list[1],
      );
    });
  }, []);

  const rawIn = useMemo(
    () => (tokenIn ? parseAmount(amount, tokenIn.decimals) : undefined),
    [amount, tokenIn],
  );

  const balanceIn = rows?.find(
    (r) => r.token.address.toLowerCase() === tokenIn?.address.toLowerCase(),
  )?.balance;
  const insufficient =
    rawIn !== undefined && balanceIn !== undefined && rawIn > balanceIn;
  const isNativeIn = tokenIn?.address.toLowerCase() === NATIVE_MON;

  // Quote: debounce on input, then refresh on an interval while the inputs hold still.
  const loadQuote = useCallback(async () => {
    if (!tokenIn || !tokenOut || rawIn === undefined || rawIn === 0n) {
      setQuote(null);
      return;
    }
    const seq = ++quoteSeq.current;
    setQuoting(true);
    try {
      const q = await fetchQuote({
        inputMint: tokenIn.address,
        outputMint: tokenOut.address,
        amount: rawIn,
        slippageBps: settings.slippageBps,
      });
      if (seq === quoteSeq.current) {
        setQuote(q);
        setQuoteAt(Date.now());
        setError(null);
      }
    } catch (err) {
      if (seq === quoteSeq.current) {
        setQuote(null);
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (seq === quoteSeq.current) setQuoting(false);
    }
  }, [tokenIn, tokenOut, rawIn, settings.slippageBps]);

  useEffect(() => {
    setDoneHash(null);
    const t = setTimeout(loadQuote, 350);
    const interval = setInterval(loadQuote, QUOTE_REFRESH_MS);
    return () => {
      clearTimeout(t);
      clearInterval(interval);
    };
  }, [loadQuote]);

  // Allowance for ERC-20 inputs.
  useEffect(() => {
    setAllowance(null);
    if (!tokenIn || isNativeIn) return;
    void readAllowance({
      rpcUrl: settings.rpcUrl,
      token: tokenIn.address as `0x${string}`,
      owner: account.address,
      spender: NULL_ROUTER,
    })
      .then(setAllowance)
      .catch(() => setAllowance(null));
  }, [tokenIn, isNativeIn, account.address, settings.rpcUrl, doneHash]);

  const needsApprove =
    !isNativeIn &&
    rawIn !== undefined &&
    rawIn > 0n &&
    allowance !== null &&
    allowance < rawIn;

  const flip = () => {
    if (!tokenIn || !tokenOut) return;
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmount("");
    setQuote(null);
  };

  const approve = async () => {
    if (!tokenIn || rawIn === undefined) return;
    setBusy("approve");
    setError(null);
    try {
      const hash = await sendTransaction({
        accountIndex: account.index,
        from: account.address,
        rpcUrl: settings.rpcUrl,
        kind: "approve",
        summary: `Approve ${tokenIn.symbol} for NullRouter`,
        tx: {
          to: tokenIn.address as `0x${string}`,
          data: encodeErc20Approve(NULL_ROUTER, rawIn),
        },
      });
      await trackReceipt(hash, settings.rpcUrl);
      setAllowance(rawIn);
      await loadQuote(); // quote may have aged during the approval
    } catch (err) {
      if (err instanceof WalletLockedError) {
        openOnboarding("unlock");
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const swap = async () => {
    if (!quote || !tokenIn || !tokenOut) return;
    setBusy("swap");
    setError(null);
    try {
      const tx = await buildSwapTx({
        quoteResponse: quote,
        userPublicKey: account.address,
        slippageBps: settings.slippageBps,
      });
      const hash = await sendTransaction({
        accountIndex: account.index,
        from: account.address,
        rpcUrl: settings.rpcUrl,
        kind: "swap",
        summary: `Swap ${formatAmount(BigInt(quote.inputAmount), tokenIn.decimals)} ${tokenIn.symbol} → ${tokenOut.symbol}`,
        tx: {
          to: tx.to,
          data: tx.data,
          value: BigInt(tx.value || "0"),
          // Monad charges the LIMIT, not the usage — trust the API's own gasLimit.
          gas: BigInt(tx.gasLimit || "0") || undefined,
        },
      });
      setDoneHash(hash);
      setAmount("");
      setQuote(null);
      refresh();
    } catch (err) {
      if (err instanceof WalletLockedError) {
        openOnboarding("unlock");
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  if (!tokens || !tokenIn || !tokenOut) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const rawOut = quote ? BigInt(quote.outputAmount) : undefined;
  const noRoute = quote && quote.routePlan.length === 0;
  const dexes = quote
    ? [...new Set(quote.routePlan.map((s) => s.swapInfo.dex))]
    : [];

  return (
    <div className="flex flex-col gap-3 px-3 pb-4 pt-4">
      <div className="glass-strong gradient-ring rounded-2xl p-4">
        <div className="flex items-center justify-between pb-3">
          <MicroLabel>swap</MicroLabel>
          <span className="flex items-center gap-1.5">
            {quote && !noRoute && (
              <svg
                key={quoteAt}
                width="16"
                height="16"
                viewBox="0 0 20 20"
                className="-rotate-90"
                aria-hidden
              >
                <circle cx="10" cy="10" r="8" stroke="hsl(var(--border))" strokeWidth="2.5" fill="none" />
                <circle
                  cx="10"
                  cy="10"
                  r="8"
                  stroke="hsl(var(--mint))"
                  strokeWidth="2.5"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray="50.27"
                  className="animate-ring-drain"
                />
              </svg>
            )}
            <MintChip>best route</MintChip>
            <span className="font-mono-num text-[10px] text-muted-foreground">
              {settings.slippageBps} bps
            </span>
          </span>
        </div>

        <AmountBox
          label="you pay"
          token={tokenIn}
          value={amount}
          onChange={setAmount}
          onPick={() => setPicking("in")}
          balance={balanceIn}
          onMax={
            balanceIn !== undefined && tokenIn
              ? () =>
                  setAmount(
                    (Number(balanceIn) / 10 ** tokenIn.decimals).toString(),
                  )
              : undefined
          }
        />

        <div className="relative z-10 -my-2 flex justify-center">
          <button
            type="button"
            onClick={flip}
            className="glass flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 text-muted-foreground transition-all duration-200 hover:-translate-y-px hover:border-primary/50 hover:text-foreground"
            title="Flip"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 4v16m0 0-5-5m5 5 5-5" />
            </svg>
          </button>
        </div>

        <AmountBox
          label="you receive"
          token={tokenOut}
          value={
            quoting && !quote
              ? "…"
              : rawOut !== undefined && tokenOut
                ? formatAmount(rawOut, tokenOut.decimals)
                : ""
          }
          readOnly
          onPick={() => setPicking("out")}
        />

        {quote && !noRoute && (
          <div className="mt-3 space-y-1.5 border-t border-border/40 pt-3">
            <button
              type="button"
              onClick={() => setRateFlipped((v) => !v)}
              className="flex w-full items-center justify-between gap-2 transition-opacity hover:opacity-80"
              title="Flip rate"
            >
              <span className="font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground">
                rate
              </span>
              <span className="font-mono-num text-xs font-semibold">
                {formatRate(quote, tokenIn, tokenOut, rateFlipped)}
              </span>
            </button>
            <DetailRow
              label="min received"
              value={`${formatAmount(BigInt(quote.otherAmountThreshold), tokenOut.decimals)} ${tokenOut.symbol}`}
            />
            <DetailRow
              label="price impact"
              value={`${Number(quote.priceImpactPct).toFixed(2)}%`}
              tone={Number(quote.priceImpactPct) > 3 ? "danger" : undefined}
            />
            <DetailRow
              label="protocol fee"
              value={
                quote.feeBps !== undefined
                  ? `${quote.feeBps} bps · ${quote.feeTier ?? ""}`
                  : "—"
              }
            />
            <div className="flex items-start justify-between gap-2">
              <span className="pt-0.5 font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground">
                route
              </span>
              <span className="flex flex-wrap justify-end gap-1">
                {dexes.map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 font-mono-num text-[9px] uppercase tracking-wider text-primary"
                  >
                    {d.replaceAll("_", " ")}
                  </span>
                ))}
              </span>
            </div>
          </div>
        )}
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {doneHash && (
        <div className="animate-reveal-up rounded-xl border border-mint/40 bg-mint/10 px-3 py-2.5 text-sm text-mint">
          Swap sent — track it in Activity.
        </div>
      )}

      {noRoute ? (
        <div className="w-full rounded-xl bg-muted py-3.5 text-center font-semibold text-muted-foreground">
          {quote?.noRouteReason === "INSUFFICIENT_LIQUIDITY"
            ? "Size exceeds liquidity — try a smaller amount"
            : "No route for this pair"}
        </div>
      ) : needsApprove ? (
        <PrimaryButton onClick={approve} disabled={busy !== null || insufficient}>
          {busy === "approve" ? <Spinner /> : null}
          {insufficient ? "Insufficient balance" : `Approve ${tokenIn.symbol}`}
        </PrimaryButton>
      ) : (
        <PrimaryButton
          onClick={swap}
          disabled={
            busy !== null ||
            !quote ||
            insufficient ||
            rawIn === undefined ||
            rawIn === 0n
          }
        >
          {busy === "swap" ? <Spinner /> : null}
          {insufficient
            ? "Insufficient balance"
            : !rawIn || rawIn === 0n
              ? "Enter an amount"
              : quoting && !quote
                ? "Routing…"
                : "Swap"}
        </PrimaryButton>
      )}

      <p className="text-center font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground/70">
        routed by nullterminal · {quote ? `block ${quote.blockNumber}` : "16 venues"}
      </p>

      {picking && (
        <TokenSelect
          tokens={tokens}
          balances={rows}
          onPick={(t) => {
            if (picking === "in") {
              setTokenIn(t);
              if (t.address === tokenOut.address) setTokenOut(tokenIn);
            } else {
              setTokenOut(t);
              if (t.address === tokenIn.address) setTokenIn(tokenOut);
            }
            setPicking(null);
            setQuote(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}

function AmountBox({
  label,
  token,
  value,
  onChange,
  onPick,
  onMax,
  balance,
  readOnly,
}: {
  label: string;
  token: NtToken;
  value: string;
  onChange?: (v: string) => void;
  onPick: () => void;
  onMax?: () => void;
  balance?: bigint;
  readOnly?: boolean;
}) {
  return (
    <div className="group/input rounded-xl border border-border/60 bg-muted/40 p-3.5 transition-colors duration-150 focus-within:border-primary/50 hover:border-border">
      <div className="mb-1.5 flex items-center justify-between">
        <MicroLabel>{label}</MicroLabel>
        {onMax && balance !== undefined && (
          <button
            type="button"
            onClick={onMax}
            className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary"
          >
            max {formatAmount(balance, token.decimals)}
          </button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          readOnly={readOnly}
          inputMode="decimal"
          placeholder="0.0"
          className="font-mono-num w-full min-w-0 bg-transparent text-xl font-semibold tracking-tight outline-none read-only:cursor-default placeholder:text-muted-foreground/40"
        />
        <button
          type="button"
          onClick={onPick}
          className="flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-card/70 py-1.5 pl-1.5 pr-2 text-sm font-semibold shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/50"
        >
          <TokenLogo src={token.logoURI} symbol={token.symbol} size={22} />
          {token.symbol}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function formatRate(
  quote: QuoteResponse,
  tokenIn: NtToken,
  tokenOut: NtToken,
  flipped: boolean,
): string {
  const inAmt = Number(quote.inputAmount) / 10 ** tokenIn.decimals;
  const outAmt = Number(quote.outputAmount) / 10 ** tokenOut.decimals;
  if (inAmt <= 0 || outAmt <= 0) return "—";
  const [base, quoteTok, rate] = flipped
    ? [tokenOut, tokenIn, inAmt / outAmt]
    : [tokenIn, tokenOut, outAmt / inAmt];
  const shown = rate >= 1 ? rate.toFixed(4) : rate.toPrecision(4);
  return `1 ${base.symbol} = ${shown} ${quoteTok.symbol}`;
}

function DetailRow({
  label,
  value,
  tone,
  mono = true,
}: {
  label: string;
  value: string;
  tone?: "danger";
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={`${mono ? "font-mono-num" : ""} text-xs font-semibold ${
          tone === "danger" ? "text-danger" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
