// MV3 service worker — the dApp hub. Routes provider requests from content scripts:
// answers chain/account queries, proxies read-only RPC to the configured endpoint, and
// gates everything sensitive behind an approval window. Holds NO key material — signing
// happens in the approval page (an extension page with storage.session access).
import type {
  ApprovalResult,
  InternalMessage,
  PendingRequest,
  RuntimeRequest,
} from "./provider/protocol";
import { MONAD_CHAIN_ID_HEX, USER_REJECTED } from "./provider/protocol";
import { connectSite, disconnectSite, getConnectedSites, isConnected } from "./provider/sites";

const DEFAULT_RPC = "https://rpc.monad.xyz";

// Read-only JSON-RPC the page may call without approval.
const READ_METHODS = new Set([
  "eth_blockNumber",
  "eth_call",
  "eth_estimateGas",
  "eth_feeHistory",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getBlockByHash",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_getLogs",
  "eth_getStorageAt",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "eth_maxPriorityFeePerGas",
  "web3_clientVersion",
]);

const APPROVAL_METHODS = new Set([
  "personal_sign",
  "eth_signTypedData_v4",
  "eth_sendTransaction",
]);

type Resolver = (out: { result?: unknown; error?: { code: number; message: string } }) => void;
const pendingResolvers = new Map<string, Resolver>();
const windowToRequest = new Map<number, string>();

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    void chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  }
});

// ---------------------------------------------------------------------------
// helpers

async function rpcUrl(): Promise<string> {
  const out = await chrome.storage.local.get(["settings"]);
  return (out.settings as { rpcUrl?: string } | undefined)?.rpcUrl || DEFAULT_RPC;
}

async function activeAddress(): Promise<string | null> {
  const out = await chrome.storage.local.get(["accounts", "activeIndex"]);
  const accounts = (out.accounts as { index: number; address: string }[]) ?? [];
  if (!accounts.length) return null;
  const idx = (out.activeIndex as number) ?? 0;
  return (accounts.find((a) => a.index === idx) ?? accounts[0]).address;
}

async function proxyRpc(method: string, params: unknown[] | undefined) {
  const res = await fetch(await rpcUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: params ?? [] }),
  });
  const body = (await res.json()) as {
    result?: unknown;
    error?: { code: number; message: string };
  };
  if (body.error) return { error: body.error };
  return { result: body.result };
}

/** Opens the approval window for a request and resolves with the user's verdict. */
async function requestApproval(
  req: PendingRequest,
): Promise<{ result?: unknown; error?: { code: number; message: string } }> {
  await chrome.storage.session.set({ [`req:${req.id}`]: req });
  const win = await chrome.windows.create({
    url: chrome.runtime.getURL(`approval.html?id=${req.id}`),
    type: "popup",
    width: 372,
    height: 640,
    focused: true,
  });
  if (win.id !== undefined) windowToRequest.set(win.id, req.id);
  return new Promise((resolve) => {
    pendingResolvers.set(req.id, (out) => {
      pendingResolvers.delete(req.id);
      void chrome.storage.session.remove([`req:${req.id}`]);
      resolve(out);
    });
  });
}

// Closing the approval window without deciding = rejection.
chrome.windows.onRemoved.addListener((windowId) => {
  const reqId = windowToRequest.get(windowId);
  if (!reqId) return;
  windowToRequest.delete(windowId);
  pendingResolvers.get(reqId)?.({ error: USER_REJECTED });
});

async function broadcastToConnectedTabs(
  event: string,
  data: unknown,
  onlyOrigin?: string,
): Promise<void> {
  const sites = await getConnectedSites();
  const origins = onlyOrigin ? new Set([onlyOrigin]) : new Set(Object.keys(sites));
  if (!origins.size) return;
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.id === undefined || !tab.url) continue;
    try {
      if (!origins.has(new URL(tab.url).origin)) continue;
    } catch {
      continue;
    }
    chrome.tabs.sendMessage(tab.id, { type: "mera:event", event, data }).catch(() => {
      /* tab without our content script — fine */
    });
  }
}

// ---------------------------------------------------------------------------
// request handling

async function handleRequest(
  msg: RuntimeRequest,
  sender: chrome.runtime.MessageSender,
): Promise<{ result?: unknown; error?: { code: number; message: string } }> {
  const origin = sender.origin ?? (sender.url ? new URL(sender.url).origin : "");
  const tabId = sender.tab?.id;
  const favicon = sender.tab?.favIconUrl;
  const { method, params } = msg;

  if (method === "eth_chainId") return { result: MONAD_CHAIN_ID_HEX };
  if (method === "net_version") return { result: "143" };

  if (method === "eth_accounts") {
    if (!(await isConnected(origin))) return { result: [] };
    const addr = await activeAddress();
    return { result: addr ? [addr] : [] };
  }

  if (method === "eth_requestAccounts" || method === "wallet_requestPermissions") {
    const addr = await activeAddress();
    if (!addr) {
      void chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
      return { error: { code: 4001, message: "No wallet on this device yet." } };
    }
    if (!(await isConnected(origin))) {
      const verdict = await requestApproval({
        id: crypto.randomUUID(),
        origin,
        tabId,
        favicon,
        method: "connect",
        params: [],
        createdAt: Date.now(),
      });
      if (verdict.error) return verdict;
      await connectSite(origin, favicon);
    }
    if (method === "wallet_requestPermissions") {
      return { result: [{ parentCapability: "eth_accounts" }] };
    }
    return { result: [addr] };
  }

  if (method === "wallet_getPermissions") {
    return {
      result: (await isConnected(origin)) ? [{ parentCapability: "eth_accounts" }] : [],
    };
  }

  if (method === "wallet_revokePermissions") {
    await disconnectSite(origin);
    return { result: null };
  }

  if (method === "wallet_switchEthereumChain") {
    const target = (params?.[0] as { chainId?: string } | undefined)?.chainId;
    if (target?.toLowerCase() === MONAD_CHAIN_ID_HEX) return { result: null };
    return {
      error: { code: 4902, message: "merawallet only speaks Monad (chain 143)." },
    };
  }

  if (APPROVAL_METHODS.has(method)) {
    if (!(await isConnected(origin))) {
      return { error: { code: 4100, message: "Connect the wallet first." } };
    }
    return requestApproval({
      id: crypto.randomUUID(),
      origin,
      tabId,
      favicon,
      method: method as PendingRequest["method"],
      params: params ?? [],
      createdAt: Date.now(),
    });
  }

  if (READ_METHODS.has(method)) return proxyRpc(method, params);

  return { error: { code: -32601, message: `Unsupported method: ${method}` } };
}

// ---------------------------------------------------------------------------
// message router

chrome.runtime.onMessage.addListener(
  (
    msg: RuntimeRequest | ApprovalResult | InternalMessage,
    sender,
    sendResponse: Resolver,
  ) => {
    if (msg?.type === "mera:request") {
      const req = msg;
      void (async () => {
        const out = await handleRequest(req, sender);
        try {
          sendResponse(out);
        } catch {
          // SW restarted mid-flight — deliver through the tab instead.
          if (sender.tab?.id !== undefined) {
            void chrome.tabs.sendMessage(sender.tab.id, {
              type: "mera:asyncResult",
              id: req.id,
              ...out,
            });
          }
        }
      })();
      return true; // async sendResponse
    }

    if (msg?.type === "mera:approvalResult") {
      const resolver = pendingResolvers.get(msg.id);
      const out = msg.approved
        ? { result: msg.result }
        : { error: msg.error ?? USER_REJECTED };
      if (resolver) {
        resolver(out);
      } else {
        // Resolver lost to an SW restart: recover the original tab from the stored
        // request and push the result straight to the page.
        void (async () => {
          const stored = await chrome.storage.session.get([`req:${msg.id}`]);
          const req = stored[`req:${msg.id}`] as PendingRequest | undefined;
          await chrome.storage.session.remove([`req:${msg.id}`]);
          if (req?.tabId !== undefined) {
            void chrome.tabs.sendMessage(req.tabId, {
              type: "mera:asyncResult",
              id: req.id,
              ...out,
            });
          }
        })();
      }
      sendResponse({ result: true });
      return false;
    }

    if (msg?.type === "mera:internal") {
      void (async () => {
        if (msg.action === "accountsChanged") {
          const addr = await activeAddress();
          await broadcastToConnectedTabs("accountsChanged", addr ? [addr] : []);
        } else if (msg.action === "disconnectSite" && msg.origin) {
          await disconnectSite(msg.origin);
          await broadcastToConnectedTabs("accountsChanged", [], msg.origin);
        }
        sendResponse({ result: true });
      })();
      return true;
    }

    return false;
  },
);
