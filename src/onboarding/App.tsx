// The passkey console: every WebAuthn ceremony happens in this full tab, because Chrome
// closes the extension popup the moment the OS passkey sheet appears.
// Deep links from the popup: onboarding.html?action=welcome|unlock|reveal
import { useEffect, useMemo, useState } from "react";
import {
  createWallet,
  describeKeyringError,
  getKeyringState,
  importWallet,
  revealMnemonic,
  signIn,
  unlock,
} from "../keyring/keyring";
import {
  ErrorBanner,
  GhostButton,
  Mark,
  MicroLabel,
  MintChip,
  Panel,
  PrimaryButton,
  Spinner,
  StatusDot,
  Wordmark,
} from "../shared/ui";

type Action = "welcome" | "unlock" | "reveal";
type Flow = "create" | "signin" | "import";

export function App() {
  const action = useMemo<Action>(() => {
    const a = new URLSearchParams(location.search).get("action");
    return a === "unlock" || a === "reveal" ? a : "welcome";
  }, []);

  return (
    <div className="relative min-h-[100dvh] overflow-x-clip bg-background text-foreground bg-grid flex flex-col">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-glow-top" />
      <header className="glass sticky top-0 z-40 border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-2 px-4">
          <span className="flex items-center gap-2">
            <Mark size={30} />
            <Wordmark />
          </span>
          <span className="flex items-center gap-3">
            <MintChip>monad 143</MintChip>
            <StatusDot label="passkey console" />
          </span>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-16 pt-10">
        {action === "welcome" && <Welcome />}
        {action === "unlock" && <Unlock />}
        {action === "reveal" && <Reveal />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------

function BootTerminal({ lines }: { lines: string[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/90 shadow-2xl">
      <div className="flex items-center gap-1.5 border-b border-border/60 px-3.5 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(0 68% 60%)" }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(40 88% 56%)" }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(160 84% 52%)" }} />
        <span className="ml-2 font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground">
          mera://console
        </span>
      </div>
      <div className="space-y-1.5 px-4 py-4 font-mono text-[12px] leading-relaxed text-muted-foreground">
        {lines.map((line, i) => (
          <div
            key={line}
            className="animate-fade-in"
            style={{ animationDelay: `${i * 0.45}s` }}
          >
            <span className="text-mint">❯</span> {line}
          </div>
        ))}
        <span
          className="nt-caret inline-block h-[13px] w-[7px] translate-y-0.5 bg-mint"
          style={{ animationDelay: `${lines.length * 0.45}s` }}
        />
      </div>
    </div>
  );
}

function CeremonyResult({
  address,
  note,
}: {
  address: `0x${string}`;
  note: string;
}) {
  return (
    <Panel className="animate-reveal-up space-y-3 p-5">
      <div className="flex items-center gap-2">
        <MintChip>unlocked</MintChip>
        <StatusDot label="signing ready" />
      </div>
      <div>
        <MicroLabel className="mb-1">wallet address</MicroLabel>
        <div className="code-literal break-all font-mono-num text-lg font-semibold">
          {address}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{note}</p>
      <p className="text-sm text-muted-foreground">
        You can close this tab now and open the{" "}
        <span className="font-semibold text-foreground">merawallet</span> popup
        from the toolbar.
      </p>
    </Panel>
  );
}

// ---------------------------------------------------------------------------

function Welcome() {
  const [busy, setBusy] = useState<Flow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [mnemonic, setMnemonic] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    void getKeyringState().then((s) => setHasWallet(s.hasWallet));
  }, []);

  const run = async (flow: Flow) => {
    setBusy(flow);
    setError(null);
    try {
      const addr =
        flow === "create"
          ? await createWallet()
          : flow === "signin"
            ? await signIn()
            : await importWallet(mnemonic);
      setAddress(addr);
    } catch (err) {
      setError(describeKeyringError(err));
    } finally {
      setBusy(null);
    }
  };

  if (address) {
    return (
      <CeremonyResult
        address={address}
        note="Your passkey is the wallet. The recovery phrase stays re-derivable from it — back it up any time from Settings."
      />
    );
  }

  return (
    <>
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">
          A passkey <span className="gradient-text">is</span> the wallet.
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          merawallet derives your Monad account from a WebAuthn passkey using{" "}
          <span className="font-mono-num text-foreground">@category-labs/mera</span>.
          No seed phrase to write down, no custody service — your authenticator
          holds the entropy, swaps route through NullTerminal.
        </p>
      </div>

      <BootTerminal
        lines={[
          "webauthn.prf → 256-bit entropy",
          "bip39 → bip44 m/44'/60'/0'/0/0",
          "signer: in-memory, zeroed on lock",
          "network: monad mainnet · chain 143",
        ]}
      />

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel className="space-y-3 p-5">
          <MicroLabel>new here</MicroLabel>
          <h2 className="text-lg font-bold">Create wallet</h2>
          <p className="text-sm text-muted-foreground">
            One passkey prompt. Your device generates the credential; the wallet
            address falls out of it deterministically.
          </p>
          <PrimaryButton onClick={() => run("create")} disabled={busy !== null}>
            {busy === "create" ? <Spinner /> : null} Create with a passkey
          </PrimaryButton>
        </Panel>

        <Panel className="space-y-3 p-5">
          <MicroLabel>been here before</MicroLabel>
          <h2 className="text-lg font-bold">Sign in</h2>
          <p className="text-sm text-muted-foreground">
            {hasWallet
              ? "Unlock the wallet already set up on this device."
              : "Restore a wallet from a passkey synced to this device."}
          </p>
          <PrimaryButton onClick={() => run("signin")} disabled={busy !== null}>
            {busy === "signin" ? <Spinner /> : null} Sign in with a passkey
          </PrimaryButton>
        </Panel>
      </div>

      <Panel className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <div>
            <MicroLabel>bring your own keys</MicroLabel>
            <h2 className="text-lg font-bold">Import a recovery phrase</h2>
          </div>
          <GhostButton onClick={() => setShowImport((v) => !v)}>
            {showImport ? "Hide" : "Import"}
          </GhostButton>
        </div>
        {showImport && (
          <div className="animate-reveal-up space-y-3">
            <p className="text-sm text-muted-foreground">
              The phrase is encrypted behind a <em>new</em> passkey
              (AES-256-GCM keyed from its PRF output) and stored only as
              ciphertext. Signing still re-derives keys in memory.
            </p>
            <textarea
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              rows={3}
              placeholder="12 or 24 words separated by spaces"
              className="code-literal w-full resize-none rounded-xl border border-border/60 bg-muted/40 p-4 font-mono text-sm outline-none transition-colors focus:border-primary/50"
            />
            <PrimaryButton
              onClick={() => run("import")}
              disabled={busy !== null || mnemonic.trim().split(/\s+/).length < 12}
            >
              {busy === "import" ? <Spinner /> : null} Encrypt behind a new passkey
            </PrimaryButton>
          </div>
        )}
      </Panel>

      <p className="text-xs leading-relaxed text-muted-foreground/70">
        Requires an authenticator with the WebAuthn PRF extension (iCloud
        Keychain, Google Password Manager, 1Password, YubiKey 5+…). Ceremonies
        run in this tab because Chrome closes the popup when the system passkey
        sheet appears.
      </p>
    </>
  );
}

// ---------------------------------------------------------------------------

function Unlock() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await unlock();
      setDone(true);
    } catch (err) {
      setError(describeKeyringError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6 pt-10">
      <BootTerminal
        lines={["session: locked", "awaiting passkey ceremony…"]}
      />
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {done ? (
        <Panel className="animate-reveal-up space-y-2 p-5">
          <MintChip>unlocked</MintChip>
          <p className="text-sm text-muted-foreground">
            Session restored. Close this tab and open the popup — signing works
            without further prompts until the wallet locks.
          </p>
        </Panel>
      ) : (
        <PrimaryButton onClick={run} disabled={busy}>
          {busy ? <Spinner /> : null} Unlock with passkey
        </PrimaryButton>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Reveal() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [words, setWords] = useState<string[] | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setWords((await revealMnemonic()).split(" "));
    } catch (err) {
      setError(describeKeyringError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-6 pt-6">
      <div>
        <MicroLabel className="mb-1">backup</MicroLabel>
        <h1 className="text-2xl font-bold tracking-tight">Recovery phrase</h1>
      </div>
      <div className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
        Anyone with these words controls the wallet. Reveal them only on a
        screen nobody else can see, and never paste them into a website.
      </div>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      {words ? (
        <Panel className="animate-reveal-up p-5">
          <ol className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {words.map((w, i) => (
              <li key={`${i}-${w}`} className="flex items-baseline gap-2">
                <span className="font-mono-num w-6 text-right text-[11px] text-muted-foreground/70">
                  {i + 1}
                </span>
                <span className="code-literal font-mono text-sm font-semibold">
                  {w}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            Importing this phrase into any BIP-44 wallet (MetaMask etc.)
            reproduces the same addresses.
          </p>
        </Panel>
      ) : (
        <PrimaryButton onClick={run} disabled={busy}>
          {busy ? <Spinner /> : null} Reveal with passkey
        </PrimaryButton>
      )}
    </div>
  );
}
