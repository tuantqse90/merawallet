// The approval window (372×640): one dApp request in, one explicit human verdict out.
// This is an extension page, so it can read the storage.session seed and sign — the
// requesting page never gets anything but the final result.
import { useEffect, useMemo, useState } from "react";
import {
  decodeFunctionData,
  formatEther,
  hexToString,
  isHex,
} from "viem";
import { erc20Abi } from "../chain/erc20";
import { getPublicClient } from "../chain/monad";
import { sendTransaction } from "../chain/tx";
import { getKeyringState, type KeyringState } from "../keyring/keyring";
import { getSettings } from "../keyring/storage";
import { withViemAccount, WalletLockedError } from "../keyring/signer";
import { shortAddress } from "../lib/format";
import { openOnboarding } from "../lib/tabs";
import type { ApprovalResult, PendingRequest } from "../provider/protocol";
import { USER_REJECTED } from "../provider/protocol";
import { Avatar } from "../shared/Avatar";
import {
  ErrorBanner,
  GhostButton,
  Mark,
  MicroLabel,
  MintChip,
  Panel,
  PrimaryButton,
  Spinner,
  Wordmark,
} from "../shared/ui";

type TxParam = {
  from?: `0x${string}`;
  to?: `0x${string}`;
  value?: `0x${string}`;
  data?: `0x${string}`;
  gas?: `0x${string}`;
};

export function App() {
  const id = useMemo(() => new URLSearchParams(location.search).get("id"), []);
  const [req, setReq] = useState<PendingRequest | null | undefined>(undefined);
  const [keyring, setKeyring] = useState<KeyringState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setReq(null);
      return;
    }
    void chrome.storage.session
      .get([`req:${id}`])
      .then((out) => setReq((out[`req:${id}`] as PendingRequest) ?? null));
  }, [id]);

  // Signing needs an unlocked keyring; poll while the unlock tab does its ceremony.
  useEffect(() => {
    let alive = true;
    const tick = () => {
      void getKeyringState().then((s) => {
        if (alive) setKeyring(s);
      });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const finish = async (msg: Omit<ApprovalResult, "type">) => {
    await chrome.runtime.sendMessage({ type: "mera:approvalResult", ...msg });
    window.close();
  };

  const reject = () => void finish({ id: id!, approved: false, error: USER_REJECTED });

  const approve = async () => {
    if (!req || !keyring) return;
    setBusy(true);
    setError(null);
    try {
      const result = await execute(req, keyring);
      await finish({ id: req.id, approved: true, result });
    } catch (err) {
      if (err instanceof WalletLockedError) {
        setError("Wallet locked mid-flight. Unlock and try again.");
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
      setBusy(false);
    }
  };

  if (req === undefined) {
    return (
      <Frame>
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Spinner className="h-6 w-6" />
        </div>
      </Frame>
    );
  }
  if (req === null) {
    return (
      <Frame>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
          This request has expired. Go back to the site and try again.
        </div>
      </Frame>
    );
  }

  const needsUnlock = req.method !== "connect" && keyring !== null && !keyring.unlocked;
  const activeAccount =
    keyring?.accounts.find((a) => a.index === keyring.activeIndex) ??
    keyring?.accounts[0];

  return (
    <Frame origin={req.origin} favicon={req.favicon}>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        {req.method === "connect" && (
          <ConnectView account={activeAccount} origin={req.origin} />
        )}
        {req.method === "personal_sign" && <SignMessageView req={req} />}
        {req.method === "eth_signTypedData_v4" && <TypedDataView req={req} />}
        {req.method === "eth_sendTransaction" && (
          <TransactionView req={req} accountAddress={activeAccount?.address} />
        )}
        {error && <ErrorBanner>{error}</ErrorBanner>}
      </div>

      <div className="space-y-2 border-t border-border/60 px-4 py-3">
        {needsUnlock ? (
          <>
            <p className="text-center text-xs text-muted-foreground">
              The wallet is locked — unlock with your passkey, then come back here.
            </p>
            <PrimaryButton onClick={() => openOnboarding("unlock")}>
              Unlock in a new tab
            </PrimaryButton>
            <GhostButton className="w-full" onClick={reject}>
              Reject
            </GhostButton>
          </>
        ) : (
          <div className="flex gap-2">
            <GhostButton className="flex-1" onClick={reject} disabled={busy}>
              Reject
            </GhostButton>
            <PrimaryButton className="flex-1" onClick={approve} disabled={busy || !keyring}>
              {busy ? <Spinner /> : null}
              {labelFor(req.method)}
            </PrimaryButton>
          </div>
        )}
        <p className="text-center font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground/60">
          signed in-memory · key zeroed after use
        </p>
      </div>
    </Frame>
  );
}

function labelFor(method: PendingRequest["method"]): string {
  switch (method) {
    case "connect":
      return "Connect";
    case "eth_sendTransaction":
      return "Confirm";
    default:
      return "Sign";
  }
}

// ---------------------------------------------------------------------------
// execution

async function execute(req: PendingRequest, keyring: KeyringState): Promise<unknown> {
  const settings = await getSettings();
  const account =
    keyring.accounts.find((a) => a.index === keyring.activeIndex) ?? keyring.accounts[0];
  if (!account) throw new Error("No account available.");

  if (req.method === "connect") return null; // background records the site

  if (req.method === "personal_sign") {
    const [message] = req.params as [string];
    return withViemAccount(account.index, (acc) =>
      acc.signMessage({
        message: isHex(message) ? { raw: message } : String(message),
      }),
    );
  }

  if (req.method === "eth_signTypedData_v4") {
    const [, json] = req.params as [string, string];
    const typed = JSON.parse(json);
    return withViemAccount(account.index, (acc) => acc.signTypedData(typed));
  }

  // eth_sendTransaction
  const tx = (req.params as [TxParam])[0] ?? {};
  if (tx.from && tx.from.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error("Transaction `from` does not match the active account.");
  }
  if (!tx.to) throw new Error("Contract creation is not supported.");
  const summary = describeTx(tx, req.origin);
  return sendTransaction({
    accountIndex: account.index,
    from: account.address,
    rpcUrl: settings.rpcUrl,
    kind: "dapp",
    summary,
    tx: {
      to: tx.to,
      data: tx.data,
      value: tx.value ? BigInt(tx.value) : 0n,
      gas: tx.gas ? BigInt(tx.gas) : undefined,
    },
  });
}

function decodeErc20(data?: `0x${string}`) {
  if (!data || data.length < 10) return null;
  try {
    const decoded = decodeFunctionData({ abi: erc20Abi, data });
    if (decoded.functionName === "transfer" || decoded.functionName === "approve") {
      return {
        fn: decoded.functionName,
        to: decoded.args[0] as `0x${string}`,
        amount: decoded.args[1] as bigint,
      };
    }
  } catch {
    /* not an ERC-20 call */
  }
  return null;
}

function describeTx(tx: TxParam, origin: string): string {
  const erc20 = decodeErc20(tx.data);
  const host = origin.replace(/^https?:\/\//, "");
  if (erc20) {
    return `${erc20.fn === "transfer" ? "Token transfer" : "Token approval"} — ${host}`;
  }
  const mon = tx.value ? Number(formatEther(BigInt(tx.value))) : 0;
  return mon > 0 ? `Send ${mon} MON — ${host}` : `Transaction — ${host}`;
}

// ---------------------------------------------------------------------------
// views

function Frame({
  origin,
  favicon,
  children,
}: {
  origin?: string;
  favicon?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-background text-foreground bg-grid">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-glow-top" />
      <header className="glass z-20 border-b border-border/60">
        <div className="flex h-12 items-center justify-between gap-2 px-3">
          <span className="flex shrink-0 items-center gap-1.5">
            <Mark size={22} />
            <Wordmark size="text-[15px]" />
          </span>
          {origin && (
            <span className="flex min-w-0 items-center gap-1.5 rounded-full border border-border/70 bg-card/70 py-1 pl-1.5 pr-2.5">
              {favicon ? (
                <img src={favicon} alt="" width={16} height={16} className="rounded" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-primary" />
              )}
              <span className="truncate font-mono-num text-[11px]">
                {origin.replace(/^https?:\/\//, "")}
              </span>
            </span>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}

function ConnectView({
  account,
  origin,
}: {
  account?: { address: `0x${string}`; label: string };
  origin: string;
}) {
  return (
    <>
      <div className="pt-2 text-center">
        <MicroLabel className="mb-2">connection request</MicroLabel>
        <h1 className="text-xl font-bold tracking-tight">
          {origin.replace(/^https?:\/\//, "")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          wants to see your address and request signatures.
        </p>
      </div>
      {account && (
        <Panel className="flex items-center gap-3">
          <Avatar address={account.address} size={36} />
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{account.label}</span>
            <span className="code-literal font-mono-num text-xs text-muted-foreground">
              {shortAddress(account.address)}
            </span>
          </span>
          <span className="ml-auto">
            <MintChip>monad 143</MintChip>
          </span>
        </Panel>
      )}
      <Panel className="space-y-1.5 text-xs text-muted-foreground">
        <div>✓ It can view your address and balances.</div>
        <div>✓ Every signature still needs your approval here.</div>
        <div>✗ It can never move funds on its own.</div>
      </Panel>
    </>
  );
}

function SignMessageView({ req }: { req: PendingRequest }) {
  const [message] = req.params as [string];
  const text = useMemo(() => {
    if (isHex(message)) {
      try {
        return hexToString(message);
      } catch {
        return message;
      }
    }
    return String(message);
  }, [message]);
  return (
    <>
      <MicroLabel>sign message</MicroLabel>
      <Panel className="min-h-0 flex-1 overflow-y-auto">
        <pre className="code-literal whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">
          {text}
        </pre>
      </Panel>
      <p className="text-[11px] leading-relaxed text-muted-foreground/70">
        Signing proves account ownership to the site. It cannot spend funds, but
        never sign content you do not recognize.
      </p>
    </>
  );
}

function TypedDataView({ req }: { req: PendingRequest }) {
  const [, json] = req.params as [string, string];
  const pretty = useMemo(() => {
    try {
      const parsed = JSON.parse(json) as {
        domain?: { name?: string; verifyingContract?: string };
        primaryType?: string;
        message?: unknown;
      };
      return {
        domain: parsed.domain?.name ?? "—",
        contract: parsed.domain?.verifyingContract,
        primaryType: parsed.primaryType ?? "—",
        body: JSON.stringify(parsed.message ?? parsed, null, 2),
      };
    } catch {
      return { domain: "—", contract: undefined, primaryType: "—", body: json };
    }
  }, [json]);
  return (
    <>
      <MicroLabel>sign typed data</MicroLabel>
      <Panel className="space-y-1">
        <Row label="domain" value={pretty.domain} />
        <Row label="type" value={pretty.primaryType} />
        {pretty.contract && <Row label="contract" value={shortAddress(pretty.contract)} />}
      </Panel>
      <Panel className="min-h-0 flex-1 overflow-y-auto">
        <pre className="code-literal whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
          {pretty.body}
        </pre>
      </Panel>
    </>
  );
}

function TransactionView({
  req,
  accountAddress,
}: {
  req: PendingRequest;
  accountAddress?: `0x${string}`;
}) {
  const tx = (req.params as [TxParam])[0] ?? {};
  const erc20 = decodeErc20(tx.data);
  const mon = tx.value ? formatEther(BigInt(tx.value)) : "0";
  const [gas, setGas] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const settings = await getSettings();
        const client = getPublicClient(settings.rpcUrl);
        const estimate = tx.gas
          ? BigInt(tx.gas)
          : await client.estimateGas({
              account: accountAddress,
              to: tx.to,
              value: tx.value ? BigInt(tx.value) : undefined,
              data: tx.data,
            });
        const price = await client.getGasPrice();
        if (alive) setGas(`${estimate} gas · ≈ ${Number(formatEther(estimate * price)).toFixed(5)} MON`);
      } catch {
        if (alive) setGas(null);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <MicroLabel>transaction request</MicroLabel>
      <Panel className="space-y-2">
        {erc20 ? (
          <>
            <Row
              label={erc20.fn === "transfer" ? "erc-20 transfer" : "erc-20 approval"}
              value={shortAddress(tx.to!)}
            />
            <Row
              label={erc20.fn === "transfer" ? "to" : "spender"}
              value={shortAddress(erc20.to)}
            />
            <Row label="amount (raw)" value={erc20.amount.toString()} />
          </>
        ) : (
          <>
            <Row label="to" value={tx.to ? shortAddress(tx.to) : "—"} />
            <Row label="value" value={`${mon} MON`} />
            {tx.data && tx.data.length > 2 && (
              <Row label="data" value={`${(tx.data.length - 2) / 2} bytes`} />
            )}
          </>
        )}
        <Row label="network fee" value={gas ?? "estimated at send"} />
      </Panel>
      {tx.data && tx.data.length > 2 && !erc20 && (
        <Panel className="min-h-0 max-h-36 overflow-y-auto">
          <pre className="code-literal break-all font-mono text-[10px] leading-relaxed text-muted-foreground">
            {tx.data}
          </pre>
        </Panel>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-mono-num text-xs font-semibold">{value}</span>
    </div>
  );
}
