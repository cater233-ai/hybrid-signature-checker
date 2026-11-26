/**
 * proof.ts - the fest registration proof transfer.
 *
 *   pnpm proof
 *
 * Sends 0.000001 QOR (1 uqor) from this account to itself with the memo the
 * Build Before Q-Day registration asks for, which links this testnet
 * address to the registration. Same construction as send.ts - an SDK
 * EthNativeSigner bankSend, hybrid-signed - with a fixed amount, recipient
 * and memo, so there is nothing to mistype.
 */
import { StargateClient } from "@cosmjs/stargate";
import { EthNativeSigner } from "@qorechain/sdk";
import { loadAccount, network } from "./qore.js";

/** Same native-lane fee as send.ts and window.ts: hybrid transactions are large. */
const FEE = { amount: [{ denom: "uqor", amount: "100000" }], gas: "800000" };
const MEMO = "bbqd-link:iaUxBxWopcXt";
const AMOUNT_UQOR = "1"; // 0.000001 QOR

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

  const { accountNumber, sequence } = await accountSequence(net.rest, acc.cosmos);
  const signer = new EthNativeSigner(acc, { signMode: "hybrid", rest: net.rest });
  const transport = await StargateClient.connect(net.rpc);
  try {
    const res = await signer.bankSend(transport, acc.cosmos, [{ denom: "uqor", amount: AMOUNT_UQOR }], {
      chainId: net.chainId,
      accountNumber,
      sequence,
      fee: FEE,
      memo: MEMO,
    });
    if (res.code !== 0) throw new Error(`proof transfer failed on chain with code ${res.code}`);
    console.log(`sent:     0.000001 QOR from ${acc.cosmos} to itself, memo "${MEMO}"`);
    console.log(`tx hash:  ${res.transactionHash}`);
  } finally {
    transport.disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
