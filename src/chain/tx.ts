// Transaction pipeline shared by send/approve/swap. Every path: derive a short-lived
// mera signing session via withViemAccount, broadcast, log to activity, then poll the
// receipt in the background (Monad blocks are ~300ms — polling 1s resolves fast).
import { encodeFunctionData } from "viem";
import { RECEIPT_POLL_MS, RECEIPT_TIMEOUT_MS } from "../config";
import { withViemAccount } from "../keyring/signer";
import {
  appendActivity,
  patchActivity,
  type ActivityKind,
} from "../keyring/storage";
import { erc20Abi } from "./erc20";
import { getPublicClient, getWalletClient } from "./monad";

type TxRequest = {
  to: `0x${string}`;
  data?: `0x${string}`;
  value?: bigint;
  gas?: bigint;
};

export async function sendTransaction(params: {
  accountIndex: number;
  from: `0x${string}`;
  rpcUrl: string;
  tx: TxRequest;
  kind: ActivityKind;
  summary: string;
}): Promise<`0x${string}`> {
  const hash = await withViemAccount(params.accountIndex, async (account) => {
    const wallet = getWalletClient(account, params.rpcUrl);
    return wallet.sendTransaction({
      to: params.tx.to,
      data: params.tx.data,
      value: params.tx.value ?? 0n,
      gas: params.tx.gas,
    });
  });
  await appendActivity({
    hash,
    kind: params.kind,
    summary: params.summary,
    ts: Date.now(),
    status: "pending",
    from: params.from,
  });
  void trackReceipt(hash, params.rpcUrl);
  return hash;
}

export async function trackReceipt(
  hash: `0x${string}`,
  rpcUrl: string,
): Promise<"confirmed" | "failed" | "pending"> {
  const client = getPublicClient(rpcUrl);
  try {
    const receipt = await client.waitForTransactionReceipt({
      hash,
      pollingInterval: RECEIPT_POLL_MS,
      timeout: RECEIPT_TIMEOUT_MS,
    });
    const status = receipt.status === "success" ? "confirmed" : "failed";
    await patchActivity(hash, status);
    return status;
  } catch {
    return "pending"; // still unmined at timeout — leave it pending
  }
}

export function encodeErc20Transfer(
  to: `0x${string}`,
  amount: bigint,
): `0x${string}` {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [to, amount],
  });
}

export function encodeErc20Approve(
  spender: `0x${string}`,
  amount: bigint,
): `0x${string}` {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, amount],
  });
}

export async function readAllowance(params: {
  rpcUrl: string;
  token: `0x${string}`;
  owner: `0x${string}`;
  spender: `0x${string}`;
}): Promise<bigint> {
  const client = getPublicClient(params.rpcUrl);
  return client.readContract({
    address: params.token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [params.owner, params.spender],
  });
}
