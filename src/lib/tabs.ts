import { isExtension } from "../keyring/storage";

/** Opens the passkey console tab (all WebAuthn ceremonies live there). */
export function openOnboarding(action?: "unlock" | "reveal"): void {
  const path = `onboarding.html${action ? `?action=${action}` : ""}`;
  if (isExtension && chrome.tabs?.create) {
    void chrome.tabs.create({ url: chrome.runtime.getURL(path) });
    window.close();
  } else {
    window.open(`/${path}`, "_blank");
  }
}
