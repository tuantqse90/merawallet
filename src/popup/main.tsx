import { createRoot } from "react-dom/client";
import "../styles/globals.css";
import { isExtension, setLocal, setSessionSeed } from "../keyring/storage";
import { App } from "./App";

async function main() {
  // Dev preview only (plain tab + ?demo): seed the in-memory storage shim with a
  // display-only wallet so the unlocked UI can be exercised without a passkey.
  // Never runs inside the real extension, and the dummy seed signs nothing useful.
  if (!isExtension && new URLSearchParams(location.search).has("demo")) {
    await setLocal({
      walletMeta: { mode: "passkey", credentialId: "demo" },
      accounts: [
        {
          index: 0,
          address: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
          label: "Account 1",
        },
        {
          index: 1,
          address: "0x0f11eCbA753E5e6f5CD6955B62eF6f61bd554f79",
          label: "Account 2",
        },
      ],
      activeIndex: 0,
    });
    await setSessionSeed("00".repeat(64));
  }
  createRoot(document.getElementById("root")!).render(<App />);
}

void main();
