import { useEffect, useState } from "react";
import type { KeyringState } from "../../keyring/keyring";
import {
  isExtension,
  setLocal,
  type Settings as SettingsType,
} from "../../keyring/storage";
import { openOnboarding } from "../../lib/tabs";
import { getConnectedSites, type ConnectedSite } from "../../provider/sites";
import { GhostButton, MicroLabel, MintChip, Panel, VioletChip } from "../../shared/ui";

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
  const [sites, setSites] = useState<ConnectedSite[] | null>(null);

  const loadSites = () => {
    void getConnectedSites().then((map) =>
      setSites(Object.values(map).sort((a, b) => b.connectedAt - a.connectedAt)),
    );
  };
  useEffect(loadSites, []);

  const disconnect = async (origin: string) => {
    if (isExtension) {
      await chrome.runtime
        .sendMessage({ type: "mera:internal", action: "disconnectSite", origin })
        .catch(() => {});
    }
    loadSites();
  };

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
          <MicroLabel>connected sites</MicroLabel>
          <VioletChip>{state.mode === "vault" ? "vault" : "passkey"}</VioletChip>
        </div>
        {sites === null && (
          <div className="text-xs text-muted-foreground">Loading…</div>
        )}
        {sites?.length === 0 && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            No dApps connected yet. Sites you approve appear here, and each
            signature still needs a confirmation window.
          </p>
        )}
        {sites?.map((site) => (
          <div
            key={site.origin}
            className="flex items-center gap-2.5 rounded-xl border border-border/60 px-3 py-2"
          >
            {site.favicon ? (
              <img src={site.favicon} alt="" width={18} height={18} className="rounded" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-primary" />
            )}
            <span className="min-w-0 flex-1 truncate font-mono-num text-xs">
              {site.origin.replace(/^https?:\/\//, "")}
            </span>
            <button
              type="button"
              onClick={() => disconnect(site.origin)}
              className="text-[11px] font-semibold text-danger transition-opacity hover:opacity-80"
            >
              Disconnect
            </button>
          </div>
        ))}
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
        merawallet v0.3.0 · powered by mera + nullterminal
      </p>
    </div>
  );
}
