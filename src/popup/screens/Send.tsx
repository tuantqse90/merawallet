import { useMemo, useState } from "react";
import { isAddress } from "viem";
import { EXPLORER_URL, NATIVE_MON } from "../../config";
import type { NtToken } from "../../api/nullterminal";
import {
  encodeErc20Transfer,
  sendTransaction,
} from "../../chain/tx";
import type { AccountRec, Settings } from "../../keyring/storage";
import { WalletLockedError } from "../../keyring/signer";
import { formatAmount, parseAmount, shortAddress } from "../../lib/format";
import { openOnboarding } from "../../lib/tabs";
import {
  ErrorBanner,
  MicroLabel,
  PrimaryButton,
  Spinner,
  TokenLogo,
} from "../../shared/ui";
import { usePortfolio } from "../data";
import { TokenSelect } from "./TokenSelect";

export function Send({
  account,
  settings,
  prefillToken,
  onClose,
}: {
  account: AccountRec;
  settings: Settings;
  prefillToken?: string;
  onClose: () => void;
}) {
  const { rows, refresh } = usePortfolio(account.address, settings.rpcUrl);
  const [tokenAddr, setTokenAddr] = useState(prefillToken ?? NATIVE_MON);
  const [picking, setPicking] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentHash, setSentHash] = useState<`0x${string}` | null>(null);

  const row = rows?.find(
    (r) => r.token.address.toLowerCase() === tokenAddr.toLowerCase(),
  );
  const token: NtToken = row?.token ?? {
    address: tokenAddr,
    symbol: tokenAddr === NATIVE_MON ? "MON" : "…",
    name: tokenAddr === NATIVE_MON ? "Monad" : "Token",
    decimals: 18,
  };

  const raw = useMemo(
    () => parseAmount(amount, token.decimals),
    [amount, token.decimals],
  );
  const isNative = token.address.toLowerCase() === NATIVE_MON;
  const insufficient = raw !== undefined && row !== undefined && raw > row.balance;
  const validRecipient = isAddress(recipient);
  const ready =
    raw !== undefined && raw > 0n && validRecipient && !insufficient && !busy;

  const submit = async () => {
    if (!ready || raw === undefined) return;
    setBusy(true);
    setError(null);
    try {
      const to = recipient as `0x${string}`;
      const hash = await sendTransaction({
        accountIndex: account.index,
        from: account.address,
        rpcUrl: settings.rpcUrl,
        kind: "send",
        summary: `Send ${formatAmount(raw, token.decimals)} ${token.symbol} → ${shortAddress(to)}`,
        tx: isNative
          ? { to, value: raw }
          : {
              to: token.address as `0x${string}`,
              data: encodeErc20Transfer(to, raw),
            },
      });
      setSentHash(hash);
      refresh();
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
    <div className="absolute inset-0 z-20 flex flex-col overflow-y-auto bg-background">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
        <MicroLabel>send</MicroLabel>
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          Close
        </button>
      </div>

      {sentHash ? (
        <div className="flex flex-1 flex-col justify-center gap-4 px-4 pb-10">
          <div className="animate-reveal-up space-y-3 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-mint/40 bg-mint/10 shadow-glow-mint">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--mint))" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 12.5 9.5 18 20 6.5" />
              </svg>
            </div>
            <div className="text-lg font-bold">Transaction sent</div>
            <a
              href={`${EXPLORER_URL}/tx/${sentHash}`}
              target="_blank"
              rel="noreferrer"
              className="code-literal font-mono-num block break-all px-4 text-xs text-primary hover:underline"
            >
              {sentHash}
            </a>
            <p className="text-xs text-muted-foreground">
              ~300ms blocks — it should confirm almost immediately. Track it in
              Activity.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-3 py-4">
          <div className="group/input rounded-xl border border-border/60 bg-muted/40 p-4 transition-colors duration-150 focus-within:border-primary/50 hover:border-border">
            <div className="mb-2 flex items-center justify-between">
              <MicroLabel>amount</MicroLabel>
              {row && (
                <button
                  type="button"
                  onClick={() =>
                    setAmount(
                      (Number(row.balance) / 10 ** token.decimals).toString(),
                    )
                  }
                  className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary"
                >
                  max {formatAmount(row.balance, token.decimals)}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0.0"
                className="font-mono-num w-full min-w-0 bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-muted-foreground/40"
              />
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card/70 py-1.5 pl-1.5 pr-2.5 text-sm font-semibold shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/50"
              >
                <TokenLogo src={row?.token.logoURI} symbol={token.symbol} size={24} />
                {token.symbol}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
            </div>
          </div>

          <div className="group/input rounded-xl border border-border/60 bg-muted/40 p-4 transition-colors duration-150 focus-within:border-primary/50 hover:border-border">
            <MicroLabel className="mb-2">recipient</MicroLabel>
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value.trim())}
              placeholder="0x…"
              spellCheck={false}
              className="code-literal font-mono-num w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
            />
            {recipient && !validRecipient && (
              <div className="mt-1.5 text-[11px] text-danger">
                Not a valid Monad address.
              </div>
            )}
          </div>

          {error && <ErrorBanner>{error}</ErrorBanner>}

          <PrimaryButton onClick={submit} disabled={!ready}>
            {busy ? <Spinner /> : null}
            {insufficient
              ? "Insufficient balance"
              : busy
                ? "Signing…"
                : `Send ${token.symbol}`}
          </PrimaryButton>
          <p className="text-center font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground/70">
            signed in-memory · key zeroed after use
          </p>
        </div>
      )}

      {picking && rows && (
        <TokenSelect
          tokens={rows.map((r) => r.token)}
          balances={rows}
          onPick={(t) => {
            setTokenAddr(t.address);
            setPicking(false);
            setAmount("");
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}
