// Minimal MV3 service worker. All wallet logic lives in the popup and the
// onboarding tab; the worker only routes the user into onboarding on install.
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    void chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
  }
});
