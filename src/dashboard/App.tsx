// The expanded view: a full-tab dashboard fed by the NullTerminal data platform.
// Read-only by design — viewing needs no unlock (addresses are public); signing
// stays in the popup and approval windows.
import { useState } from "react";
import { shortAddress } from "../lib/format";
import { Avatar } from "../shared/Avatar";
import { Mark, MintChip, Spinner, StatusDot, Wordmark } from "../shared/ui";
import { Telemetry } from "../popup/Telemetry";
import { useKeyring, useSettings } from "../popup/data";
import { openOnboarding } from "../lib/tabs";
import { Markets } from "./views/Markets";
import { Overview } from "./views/Overview";
import { Pnl } from "./views/Pnl";
import { Tokens } from "./views/Tokens";
import { Trades } from "./views/Trades";

export type View = "overview" | "tokens" | "pnl" | "trades" | "markets";

const NAV: { id: View; label: string; d: string }[] = [
  { id: "overview", label: "Overview", d: "M3 12h4l2.5-6 5 12L17 12h4" },
  { id: "tokens", label: "Tokens", d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v10m-3.5-7.5h5a1.75 1.75 0 0 1 0 3.5h-3a1.75 1.75 0 0 0 0 3.5h5" },
  { id: "pnl", label: "PnL", d: "M4 19V5m0 14h16M8 15l3-4 3 2 5-6" },
  { id: "trades", label: "Trades", d: "M7 4v12m0 0-3-3m3 3 3-3m7 3V4m0 0-3 3m3-3 3 3" },
  { id: "markets", label: "Markets", d: "M5 20V10m7 10V4m7 16v-7" },
];

export function App() {
  const { state } = useKeyring();
  const settings = useSettings();
  const [view, setView] = useState<View>("overview");
  const [copied, setCopied] = useState(false);

  if (!state || !settings) {
    return (
      <Frame>
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          <Spinner className="h-7 w-7" />
        </div>
      </Frame>
    );
  }

  if (!state.hasWallet) {
    return (
      <Frame>
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <Mark size={72} animate />
          <p className="text-sm text-muted-foreground">
            No wallet on this device yet.
          </p>
          <button
            type="button"
            onClick={() => openOnboarding()}
            className="rounded-xl gradient-primary px-5 py-2.5 font-semibold text-white shadow-glow-primary transition-all hover:-translate-y-0.5"
          >
            Open passkey console
          </button>
        </div>
      </Frame>
    );
  }

  const account =
    state.accounts.find((a) => a.index === state.activeIndex) ?? state.accounts[0];

  const copyAddress = async () => {
    await navigator.clipboard.writeText(account.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <Frame>
      <div className="flex min-h-0 flex-1">
        {/* sidebar */}
        <aside className="glass z-20 flex w-56 shrink-0 flex-col border-r border-border/60">
          <div className="flex items-center gap-2 px-4 py-4">
            <Mark size={28} />
            <Wordmark size="text-base" />
          </div>
          <nav className="flex-1 space-y-1 px-3">
            {NAV.map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setView(item.id)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                    active
                      ? "bg-primary/20 text-foreground shadow-glow-primary"
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                  }`}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={item.d} />
                  </svg>
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="space-y-2.5 border-t border-border/60 px-4 py-3.5">
            <button
              type="button"
              onClick={copyAddress}
              className="flex w-full items-center gap-2 text-left"
              title="Copy address"
            >
              <Avatar address={account.address} size={28} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">
                  {account.label}
                </span>
                <span className="font-mono-num text-[10px] text-muted-foreground">
                  {copied ? (
                    <span className="text-mint">copied ✓</span>
                  ) : (
                    shortAddress(account.address)
                  )}
                </span>
              </span>
              {!state.unlocked && (
                <span className="ml-auto">
                  <MintChip>locked</MintChip>
                </span>
              )}
            </button>
            <StatusDot label="nullterminal data" />
          </div>
          <Telemetry rpcUrl={settings.rpcUrl} />
        </aside>

        {/* content */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div key={view} className="animate-fade-in mx-auto max-w-5xl px-6 py-8">
            {view === "overview" && (
              <Overview account={account} settings={settings} goto={setView} />
            )}
            {view === "tokens" && <Tokens account={account} settings={settings} />}
            {view === "pnl" && <Pnl account={account} />}
            {view === "trades" && <Trades account={account} />}
            {view === "markets" && <Markets />}
          </div>
        </main>
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground bg-grid">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-glow-top" />
      {children}
    </div>
  );
}
