// Per-origin dApp connections. Public data only (an origin ↔ permission flag);
// the connected account is always the wallet's active account.
export type ConnectedSite = {
  origin: string;
  favicon?: string;
  connectedAt: number;
};

const KEY = "connectedSites";

type SitesMap = Record<string, ConnectedSite>;

export async function getConnectedSites(): Promise<SitesMap> {
  const out = await chrome.storage.local.get([KEY]);
  return (out[KEY] as SitesMap) ?? {};
}

export async function isConnected(origin: string): Promise<boolean> {
  return !!(await getConnectedSites())[origin];
}

export async function connectSite(origin: string, favicon?: string): Promise<void> {
  const sites = await getConnectedSites();
  sites[origin] = { origin, favicon, connectedAt: Date.now() };
  await chrome.storage.local.set({ [KEY]: sites });
}

export async function disconnectSite(origin: string): Promise<void> {
  const sites = await getConnectedSites();
  delete sites[origin];
  await chrome.storage.local.set({ [KEY]: sites });
}
