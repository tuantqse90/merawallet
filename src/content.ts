// Isolated-world relay: window.postMessage ↔ chrome.runtime messaging. Stateless —
// each page request wakes the service worker via sendMessage, so there is no port
// lifecycle to manage. Zero runtime imports (bundles as a classic script).
import type { PageRequest, PageResponse, RuntimeAsync, RuntimeRequest } from "./provider/protocol";

window.addEventListener("message", (ev: MessageEvent) => {
  if (ev.source !== window) return;
  const d = ev.data as PageRequest;
  if (!d || d.source !== "mera:inpage" || !d.id) return;

  const msg: RuntimeRequest = {
    type: "mera:request",
    id: d.id,
    method: d.method,
    params: d.params,
  };
  chrome.runtime
    .sendMessage(msg)
    .then((resp: { result?: unknown; error?: { code: number; message: string } } | undefined) => {
      // undefined ⇒ the SW died before sendResponse; the asyncResult fallback path
      // (background → tabs.sendMessage) delivers instead, so stay quiet here.
      if (!resp) return;
      const out: PageResponse = { source: "mera:content", id: d.id, ...resp };
      window.postMessage(out, "*");
    })
    .catch(() => {
      const out: PageResponse = {
        source: "mera:content",
        id: d.id,
        error: { code: -32603, message: "Wallet is unavailable" },
      };
      window.postMessage(out, "*");
    });
});

chrome.runtime.onMessage.addListener((msg: RuntimeAsync) => {
  if (msg?.type === "mera:asyncResult") {
    const out: PageResponse = {
      source: "mera:content",
      id: msg.id,
      result: msg.result,
      error: msg.error,
    };
    window.postMessage(out, "*");
  } else if (msg?.type === "mera:event") {
    const out: PageResponse = {
      source: "mera:content",
      event: msg.event,
      data: msg.data,
    };
    window.postMessage(out, "*");
  }
});
