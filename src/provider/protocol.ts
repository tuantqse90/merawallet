// Wire types shared by inpage / content / background / approval.
// inpage.ts and content.ts may ONLY `import type` from here — they must bundle
// as classic scripts with zero runtime imports.

/** window.postMessage frames between the page provider and the relay. */
export type PageRequest = {
  source: "mera:inpage";
  id: string;
  method: string;
  params?: unknown[];
};

export type PageResponse = {
  source: "mera:content";
  id?: string;
  result?: unknown;
  error?: { code: number; message: string };
  /** EIP-1193 event push (accountsChanged, chainChanged, disconnect). */
  event?: string;
  data?: unknown;
};

/** chrome.runtime messages. */
export type RuntimeRequest = {
  type: "mera:request";
  id: string;
  method: string;
  params?: unknown[];
};

export type RuntimeAsync = {
  type: "mera:asyncResult" | "mera:event";
  id?: string;
  result?: unknown;
  error?: { code: number; message: string };
  event?: string;
  data?: unknown;
};

export type ApprovalResult = {
  type: "mera:approvalResult";
  id: string;
  approved: boolean;
  result?: unknown;
  error?: { code: number; message: string };
};

export type InternalMessage = {
  type: "mera:internal";
  action: "accountsChanged" | "disconnectSite";
  origin?: string;
};

/** Pending approval record persisted in storage.session under `req:<id>`. */
export type PendingRequest = {
  id: string;
  origin: string;
  tabId?: number;
  favicon?: string;
  method: "connect" | "personal_sign" | "eth_signTypedData_v4" | "eth_sendTransaction";
  params: unknown[];
  createdAt: number;
};

export const MONAD_CHAIN_ID_HEX = "0x8f";
export const MONAD_CHAIN_ID_DEC = "143";

export const USER_REJECTED = { code: 4001, message: "User rejected the request." };
