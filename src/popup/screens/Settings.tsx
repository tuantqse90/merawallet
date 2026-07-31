import { useState } from "react";
import type { KeyringState } from "../../keyring/keyring";
import { addAccount, setActiveIndex } from "../../keyring/keyring";
import {
  setLocal,
  type Settings as SettingsType,
} from "../../keyring/storage";
import { shortAddress } from "../../lib/format";
import { openOnboarding } from "../../lib/tabs";
import {
  GhostButton,
  MicroLabel,
  MintChip,
  Panel,
  VioletChip,
} from "../../shared/ui";

export function Settings({
  state,
  settings,
  onLock,
  onChanged,
}: {
  state: KeyringState;
  settings: SettingsType;
  onLock: () => Promise<void>;
  onChanged: () => void;
}) {
  const [rpcUrl, setRpcUrl] = useState(settings.rpcUrl);
  const [slippage, setSlippage] = useState(String(settings.slippageBps));
  const [autoLock, setAutoLock] = useState(String(settings.autoLockMinutes));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const slippageBps = Math.min(5000, Math.max(1, Number(slippage) || 50));
    const autoLockMinutes = Math.max(0, Number(autoLock) || 0);
    await setLocal({
      settings: { rpcUrl: rpcUrl.trim() || settings.rpcUrl, slippageBps, autoLockMinutes },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onChanged();
  };

  return (
    <div className="flex flex-col gap-3 px-3 pb-4 pt-4">
      <Panel className="space-y-2.5">
        <div className="flex items-center justify-between">
          <MicroLabel>accounts</MicroLabel>
          <VioletChip>{state.mode === "vault" ? "vault" : "passkey"}</VioletChip>
        </div>
        {state.accounts.map((a) => (
          <button
            key={a.index}
            type="button"
            onClick={async () => {
              await setActiveIndex(a.index);
              onChanged();
            }}
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors ${
              a.index === state.activeIndex
                ? "border-primary/50 bg-primary/10"
                : "border-border/60 hover:border-primary/40"
            }`}
          >
            <span className="text-sm font-semibold">{a.label}</span>
            <span className="font-mono-num text-xs text-muted-foreground">
              {shortAddress(a.address)}
            </span>
          </button>
        ))}
        {error && <div className="text-xs text-danger">{error}</div>}
        <GhostButton
          className="w-full"
          onClick={async () => {
            setError(null);
            try {
              await addAccount();
              onChanged();
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            }
          }}
        >
          + Derive next account
        </GhostButton>
      </Panel>

      <Panel className="space-y-3">
        <MicroLabel>network & trading</MicroLabel>
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">RPC URL</span>
          <input
            value={rpcUrl}
            onChange={(e) => setRpcUrl(e.target.value)}
            spellCheck={false}
            className="code-literal font-mono-num w-full rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-xs outline-none transition-colors focus:border-primary/50"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">
              Slippage (bps)
            </span>
            <input
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              inputMode="numeric"
              className="font-mono-num w-full rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">
              Auto-lock (min, 0=off)
            </span>
            <input
              value={autoLock}
              onChange={(e) => setAutoLock(e.target.value)}
              inputMode="numeric"
              className="font-mono-num w-full rounded-xl border border-border/60 bg-muted/40 px-3 py-2 text-sm outline-none transition-colors focus:border-primary/50"
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <GhostButton className="flex-1" onClick={save}>
            Save
          </GhostButton>
          {saved && <MintChip>saved</MintChip>}
        </div>
      </Panel>

      <Panel className="space-y-2">
        <MicroLabel>security</MicroLabel>
        <GhostButton className="w-full" onClick={() => openOnboarding("reveal")}>
          Reveal recovery phrase
        </GhostButton>
        <button
          type="button"
          onClick={onLock}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger transition-all duration-200 hover:-translate-y-px"
        >
          Lock wallet now
        </button>
        <p className="text-[11px] leading-relaxed text-muted-foreground/70">
          Locking clears the in-memory seed. Unlocking again takes one passkey
          ceremony. Closing the browser locks automatically.
        </p>
      </Panel>

      <p className="px-1 text-center font-mono-num text-[10px] uppercase tracking-wider text-muted-foreground/60">
        merawallet v0.2.0 · powered by mera + nullterminal
      </p>
    </div>
  );
}
