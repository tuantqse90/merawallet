// 360×600 popup shell. No WebAuthn here — locked/no-wallet states hand off to the
// onboarding tab. Unlocked: bottom-tab navigation in the NullTerminal idiom.
import { useState } from "react";
import type { TokenBalance } from "../chain/balances";
import { addAccount, lock, setActiveIndex, type KeyringState } from "../keyring/keyring";
import { isExtension } from "../keyring/storage";
import { openOnboarding } from "../lib/tabs";
import { shortAddress } from "../lib/format";
import { Avatar } from "../shared/Avatar";
import {
  GhostButton,
  Mark,
  MicroLabel,
  PrimaryButton,
  Spinner,
  StatusDot,
  Wordmark,
} from "../shared/ui";
import { useKeyring, useSettings } from "./data";
import { Activity } from "./screens/Activity";
import { Portfolio } from "./screens/Portfolio";
import { Receive } from "./screens/Receive";
import { Send } from "./screens/Send";
import { Settings } from "./screens/Settings";
import { Swap } from "./screens/Swap";
import { TokenDetail } from "./screens/TokenDetail";

export type Tab = "portfolio" | "swap" | "activity" | "settings";
export type Overlay =
  | { kind: "send"; prefillToken?: string }
  | { kind: "receive" }
  | { kind: "accounts" }
  | { kind: "detail"; row: TokenBalance }
  | null;

/** Tell the background hub so connected dApps get an accountsChanged event. */
function notifyAccountsChanged(): void {
  if (!isExtension) return;
  void chrome.runtime
    .sendMessage({ type: "mera:internal", action: "accountsChanged" })
    .catch(() => {});
}

export function App() {
  const { state, reload } = useKeyring();
  const settings = useSettings();
  const [tab, setTab] = useState<Tab>("portfolio");
  const [overlay, setOverlay] = useState<Overlay>(null);

  if (!state || !settings) {
    return (
      <Shell>
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Spinner className="h-6 w-6" />
        </div>
      </Shell>
    );
  }

  if (!state.hasWallet) return <Gate mode="new" />;
  if (!state.unlocked) return <Gate mode="locked" />;

  const account = state.accounts.find((a) => a.index === state.activeIndex) ??
    state.accounts[0];

  return (
    <Shell
      header={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("settings")}
            className="font-mono-num rounded-full border border-border/70 bg-card/70 px-2.5 py-1 text-[11px] font-semibold transition-colors hover:border-primary/50"
            title={account.address}
          >
            {shortAddress(account.address)}
          </button>
          <StatusDot />
        </div>
      }
      footer={<TabBar tab={tab} setTab={setTab} />}
    >
      {overlay?.kind === "send" && account && (
        <Send
          account={account}
          settings={settings}
          prefillToken={overlay.prefillToken}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === "receive" && account && (
        <Receive account={account} onClose={() => setOverlay(null)} />
      )}
      {overlay?.kind === "detail" && account && (
        <TokenDetail
          row={overlay.row}
          account={account}
          onSend={() =>
            setOverlay({ kind: "send", prefillToken: overlay.row.token.address })
          }
          onSwap={() => {
            setOverlay(null);
            setTab("swap");
          }}
          onClose={() => setOverlay(null)}
        />
      )}
      {overlay?.kind === "accounts" && (
        <AccountSheet
          state={state}
          onClose={() => setOverlay(null)}
          onChanged={() => {
            notifyAccountsChanged();
            reload();
          }}
        />
      )}
      <div key={tab} className="animate-fade-in flex min-h-full flex-col">
        {tab === "portfolio" && (
          <Portfolio
            account={account}
            settings={settings}
            onSend={(token) => setOverlay({ kind: "send", prefillToken: token })}
            onReceive={() => setOverlay({ kind: "receive" })}
            onSwap={() => setTab("swap")}
            onAccounts={() => setOverlay({ kind: "accounts" })}
            onDetail={(row) => setOverlay({ kind: "detail", row })}
          />
        )}
        {tab === "swap" && <Swap account={account} settings={settings} />}
        {tab === "activity" && <Activity settings={settings} />}
        {tab === "settings" && (
          <Settings
            state={state}
            settings={settings}
            onLock={async () => {
              await lock();
              reload();
            }}
            onChanged={reload}
          />
        )}
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------

function Shell({
  header,
  footer,
  children,
}: {
  header?: React.ReactNode;
  footer?: React.ReactNode;
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
          {header}
        </div>
      </header>
      <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
        {children}
      </main>
      {footer}
    </div>
  );
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string; d: string }[] = [
    { id: "portfolio", label: "Wallet", d: "M3 10h18M5 6h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm11 8h.01" },
    { id: "swap", label: "Swap", d: "M7 4v12m0 0-3-3m3 3 3-3m7 3V4m0 0-3 3m3-3 3 3" },
    { id: "activity", label: "Activity", d: "M3 12h4l2.5-6 5 12L17 12h4" },
    { id: "settings", label: "Settings", d: "M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Zm7.5 3.5a7.5 7.5 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-2-1.2L14.7 3h-4l-.4 2.7a7.6 7.6 0 0 0-2 1.2l-2.3-1-2 3.4 2 1.5a7.5 7.5 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 2 1.2l.4 2.7h4l.4-2.7a7.6 7.6 0 0 0 2-1.2l2.3 1 2-3.4-2-1.5c.06-.4.1-.8.1-1.2Z" },
  ];
  return (
    <nav className="glass-strong z-20 grid grid-cols-4 border-t border-border/60">
      {items.map((item) => {
        const active = tab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {active && (
              <span className="absolute top-0 h-0.5 w-9 rounded-full bg-gradient-to-r from-primary to-mint shadow-glow-primary" />
            )}
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d={item.d} />
            </svg>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------

/** Bottom-sheet account switcher (MetaMask bones, NT skin). */
function AccountSheet({
  state,
  onClose,
  onChanged,
}: {
  state: KeyringState;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-background/70 backdrop-blur-sm">
      <button type="button" aria-label="Close" className="flex-1" onClick={onClose} />
      <div className="glass-strong gradient-ring animate-modal-in max-h-[70%] overflow-y-auto rounded-t-2xl p-4">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <MicroLabel className="mb-3">accounts</MicroLabel>
        <div className="space-y-2">
          {state.accounts.map((a) => {
            const active = a.index === state.activeIndex;
            return (
              <button
                key={a.index}
                type="button"
                onClick={async () => {
                  await setActiveIndex(a.index);
                  onChanged();
                  onClose();
                }}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  active
                    ? "border-primary/50 bg-primary/10 shadow-glow-primary"
                    : "border-border/60 hover:border-primary/40"
                }`}
              >
                <Avatar address={a.address} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{a.label}</span>
                  <span className="font-mono-num text-[11px] text-muted-foreground">
                    {shortAddress(a.address)}
                  </span>
                </span>
                {active && (
                  <span className="font-mono-num text-[10px] uppercase tracking-wider text-mint">
                    active
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {error && <div className="mt-2 text-xs text-danger">{error}</div>}
        <GhostButton
          className="mt-3 w-full"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              await addAccount();
              onChanged();
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          + Derive next account
        </GhostButton>
      </div>
    </div>
  );
}

function Gate({ mode }: { mode: "new" | "locked" }) {
  return (
    <Shell>
      <div className="flex flex-1 flex-col justify-center gap-6 px-5 pb-8">
        <div className="flex flex-col items-center gap-3">
          <span className="animate-glow-breathe rounded-3xl p-1 shadow-glow-primary">
            <Mark size={64} animate />
          </span>
          <Wordmark size="text-2xl" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/90 shadow-2xl">
          <div className="flex items-center gap-1.5 border-b border-border/60 px-3.5 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(0 68% 60%)" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(40 88% 56%)" }} />
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "hsl(160 84% 52%)" }} />
            <span className="ml-2 font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground">
              mera://boot
            </span>
          </div>
          <div className="space-y-1.5 px-4 pt-4 font-mono text-[12px] leading-relaxed text-muted-foreground">
            <div>
              <span className="text-mint">❯</span>{" "}
              {mode === "new" ? "no wallet on this device" : "session locked"}
            </div>
            <div>
              <span className="text-mint">❯</span>{" "}
              {mode === "new"
                ? "a passkey is all you need"
                : "one passkey ceremony restores signing"}
            </div>
            <span className="nt-caret inline-block h-[13px] w-[7px] translate-y-0.5 bg-mint" />
          </div>
          <div className="px-4 pb-4 pt-3">
            <div className="h-0.5 overflow-hidden rounded-full bg-border/60">
              <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-primary to-mint animate-boot-sweep" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <MicroLabel>
            {mode === "new" ? "get started" : "welcome back"}
          </MicroLabel>
          <PrimaryButton
            onClick={() => openOnboarding(mode === "locked" ? "unlock" : undefined)}
          >
            {mode === "new" ? "Open passkey console" : "Unlock with passkey"}
          </PrimaryButton>
          <p className="text-xs leading-relaxed text-muted-foreground/70">
            Opens a tab — Chrome closes this popup when the system passkey sheet
            appears, so ceremonies run in a full page.
          </p>
        </div>
      </div>
    </Shell>
  );
}
