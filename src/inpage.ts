// The in-page EIP-1193 provider, injected into the MAIN world at document_start.
// HARD CONSTRAINT: zero runtime imports — this file must bundle to a classic script
// (`import type` only). It talks to the extension exclusively through window.postMessage;
// the page never sees chrome.* APIs or key material.
import type { PageRequest, PageResponse } from "./provider/protocol";

(() => {
  const w = window as unknown as Record<string, unknown>;
  if (w.__meraProviderInjected) return;
  w.__meraProviderInjected = true;

  const CHAIN_ID = "0x8f";
  const ICON =
    "data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%20128%20128'%3E%3Cdefs%3E%3ClinearGradient%20id='g'%20x1='0'%20y1='0'%20x2='0'%20y2='1'%3E%3Cstop%20offset='0'%20stop-color='%239B86FF'/%3E%3Cstop%20offset='1'%20stop-color='%235538C8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width='128'%20height='128'%20rx='29'%20fill='url(%23g)'/%3E%3Cpath%20d='M26%2098%20V34%20L64%2072%20L102%2034%20V98'%20fill='none'%20stroke='%23fff'%20stroke-width='13'%20stroke-linecap='round'%20stroke-linejoin='round'/%3E%3Ccircle%20cx='26'%20cy='98'%20r='11'%20fill='%23fff'/%3E%3Ccircle%20cx='102'%20cy='98'%20r='11'%20fill='%23fff'/%3E%3Ccircle%20cx='64'%20cy='44'%20r='7'%20fill='%232CEDAC'/%3E%3C/svg%3E";

  type Pending = {
    resolve: (value: unknown) => void;
    reject: (reason: Error & { code?: number }) => void;
  };
  const pending = new Map<string, Pending>();
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

  function emit(event: string, data: unknown): void {
    listeners.get(event)?.forEach((fn) => {
      try {
        fn(data);
      } catch {
        /* listener errors are the page's problem */
      }
    });
  }

  function providerError(code: number, message: string): Error & { code: number } {
    const err = new Error(message) as Error & { code: number };
    err.code = code;
    return err;
  }

  window.addEventListener("message", (ev: MessageEvent) => {
    if (ev.source !== window) return;
    const d = ev.data as PageResponse;
    if (!d || d.source !== "mera:content") return;
    if (d.event) {
      if (d.event === "accountsChanged") {
        provider.selectedAddress = Array.isArray(d.data) && d.data.length
          ? String((d.data as string[])[0])
          : null;
      }
      emit(d.event, d.data);
      return;
    }
    if (!d.id) return;
    const p = pending.get(d.id);
    if (!p) return; // duplicate delivery (sendResponse + asyncResult fallback) — first wins
    pending.delete(d.id);
    if (d.error) p.reject(providerError(d.error.code, d.error.message));
    else p.resolve(d.result);
  });

  const provider = {
    isMera: true,
    isMetaMask: false,
    chainId: CHAIN_ID,
    networkVersion: "143",
    selectedAddress: null as string | null,

    request(args: { method: string; params?: unknown[] }): Promise<unknown> {
      if (!args || typeof args.method !== "string") {
        return Promise.reject(providerError(-32602, "Invalid request"));
      }
      if (args.method === "eth_chainId") return Promise.resolve(CHAIN_ID);
      if (args.method === "net_version") return Promise.resolve("143");
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      return new Promise((resolve, reject) => {
        pending.set(id, {
          resolve: (value) => {
            if (args.method === "eth_requestAccounts" || args.method === "eth_accounts") {
              const accs = value as string[];
              provider.selectedAddress = accs?.length ? accs[0] : null;
            }
            resolve(value);
          },
          reject,
        });
        const msg: PageRequest = {
          source: "mera:inpage",
          id,
          method: args.method,
          params: args.params,
        };
        window.postMessage(msg, "*");
      });
    },

    on(event: string, handler: (...args: unknown[]) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(handler);
      return provider;
    },
    removeListener(event: string, handler: (...args: unknown[]) => void) {
      listeners.get(event)?.delete(handler);
      return provider;
    },

    // Legacy surface some dApps still poke.
    enable(): Promise<unknown> {
      return provider.request({ method: "eth_requestAccounts" });
    },
    isConnected(): boolean {
      return true;
    },
    send(methodOrPayload: unknown, params?: unknown[]): Promise<unknown> {
      if (typeof methodOrPayload === "string") {
        return provider.request({ method: methodOrPayload, params });
      }
      const p = methodOrPayload as { method: string; params?: unknown[] };
      return provider.request({ method: p.method, params: p.params });
    },
    sendAsync(
      payload: { id?: number; jsonrpc?: string; method: string; params?: unknown[] },
      callback: (error: unknown, response?: unknown) => void,
    ): void {
      provider
        .request({ method: payload.method, params: payload.params })
        .then((result) =>
          callback(null, { id: payload.id, jsonrpc: "2.0", result }),
        )
        .catch((error) => callback(error));
    },
  };

  // EIP-6963: the standards-track discovery path. Never fight over window.ethereum —
  // announce, and claim the legacy global only when nobody else has.
  const info = {
    uuid: crypto.randomUUID(),
    name: "merawallet",
    icon: ICON,
    rdns: "xyz.nullterminal.merawallet",
  };
  function announce(): void {
    window.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", {
        detail: Object.freeze({ info, provider }),
      }),
    );
  }
  window.addEventListener("eip6963:requestProvider", announce);
  announce();

  if (!("ethereum" in w) || w.ethereum === undefined) {
    try {
      Object.defineProperty(window, "ethereum", {
        value: provider,
        writable: true,
        configurable: true,
      });
    } catch {
      /* another wallet raced us — 6963 still works */
    }
  }
})();
