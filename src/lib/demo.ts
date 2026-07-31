// Dev-preview seeding (plain tab + ?demo): a display-only wallet so unlocked UI can be
// exercised without a passkey. Never runs inside the real extension; the dummy seed
// signs nothing useful.
import { isExtension, setLocal, setSessionSeed } from "../keyring/storage";

export async function seedDemoIfRequested(): Promise<void> {
  if (isExtension || !new URLSearchParams(location.search).has("demo")) return;
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
