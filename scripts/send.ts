/**
 * send.ts - send one hybrid-signed transfer on the testnet.
 *
 *   pnpm send                     send 1 QOR to this account itself
 *   pnpm send <qor1...> <amount>  send <amount> QOR to another testnet address
 *
 * The transfer is a plain bank MsgSend, but it is signed hybrid - classical
 * secp256k1 plus ML-DSA-87 - through the SDK's EthNativeSigner, so the chain
 * verifies both signatures and records a pqc_hybrid_verify event. Read the
 * result back with `pnpm verify <hash>`.
 *
 * The account's ML-DSA-87 key must be registered first (once):
 *   pnpm window register
 */
import { StargateClient } from "@cosmjs/stargate";
import { EthNativeSigner, fetchPqcStatus } from "@qorechain/sdk";
import { isQorAddress, loadAccount, network } from "./qore.js";

/** Same native-lane fee as scripts/window.ts: hybrid transactions are large. */
const FEE = { amount: [{ denom: "uqor", amount: "100000" }], gas: "800000" };
const MEMO = "Build Before Q-Day: hybrid-signed send";

/** Convert a QOR amount typed by a person ("1", "0.5") to uqor, exactly. */
function toUqor(amount: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(amount)) {
    throw new Error(`amount must be a number with up to 6 decimals, got "${amount}"`);
  }
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

async function accountSequence(rest: string, address: string): Promise<{ accountNumber: bigint; sequence: bigint }> {
  const res = await fetch(`${rest}/cosmos/auth/v1beta1/accounts/${address}`);
  if (res.status === 404) throw new Error(`${address} does not exist on chain yet: fund it from the faucet first`);
  if (!res.ok) throw new Error(`account query failed: HTTP ${res.status}`);
  const body = (await res.json()) as { account?: Record<string, any> };
  const acc = (body.account?.base_account ?? body.account ?? {}) as Record<string, string>;
  return { accountNumber: BigInt(acc.account_number ?? "0"), sequence: BigInt(acc.sequence ?? "0") };
}

async function main(): Promise<void> {
  const net = network();
  const acc = await loadAccount();

  const recipient = process.argv[2] ?? acc.cosmos;
  const amountQor = process.argv[3] ?? "1";
  if (!isQorAddress(recipient)) throw new Error(`recipient must be a qor1... address, got "${recipient}"`);
  const amount = toUqor(amountQor);
  if (amount <= 0n) throw new Error("amount must be more than 0");
  if (amount > 10_000_000n) throw new Error("amount is capped at 10 QOR for this demo");

  const pqc = await fetchPqcStatus({ rest: net.rest, address: acc.cosmos });
  if (!pqc.registered) {
    throw new Error("This account has no ML-DSA-87 key on chain yet. Run `pnpm window register` once, then retry.");
  }

  const { accountNumber, sequence } = await accountSequence(net.rest, acc.cosmos);
  const signer = new EthNativeSigner(acc, { signMode: "hybrid", rest: net.rest });
  const transport = await StargateClient.connect(net.rpc);
  try {
    const res = await signer.bankSend(transport, recipient, [{ denom: "uqor", amount: amount.toString() }], {
      chainId: net.chainId,
      accountNumber,
      sequence,
      fee: FEE,
      memo: MEMO,
    });
    console.log(`sent:     ${amountQor} QOR from ${acc.cosmos} to ${recipient}`);
    console.log(`tx hash:  ${res.transactionHash}`);
    console.log(`verify:   pnpm verify ${res.transactionHash}`);
  } finally {
    transport.disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
