import type { TokenBalance } from "../../chain/balances";
import { EXPLORER_URL, NATIVE_MON } from "../../config";
import type { AccountRec } from "../../keyring/storage";
import { formatAmount, formatPercent, formatUsd } from "../../lib/format";
import { GhostButton, MicroLabel, MintChip, Panel, PrimaryButton, TokenLogo } from "../../shared/ui";

export function TokenDetail({
  row,
  account,
  onSend,
  onSwap,
  onClose,
}: {
  row: TokenBalance;
  account: AccountRec;
  onSend: () => void;
  onSwap: () => void;
  onClose: () => void;
}) {
  const { token } = row;
  const isNative = token.address.toLowerCase() === NATIVE_MON;
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
