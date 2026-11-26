/**
 * verify.ts - read a transaction back from the chain and show the proof.
 *
 *   pnpm verify <tx hash>
 *
 * Read-only: this script never touches .env or any key. It fetches the
 * transaction from the public REST endpoint and prints what the chain
 * recorded: the PQCHybridSignature extension, the size of both signatures
 * and the pqc_hybrid_verify event the validators emitted.
 *
 * Exit code is 0 only when the transaction succeeded AND the chain's
 * verdict is "verified".
 */
import { fetchTx, isTxHash, network, parseTxReport } from "./qore.js";

async function main(): Promise<void> {
  const hash = (process.argv[2] ?? "").toUpperCase();
  if (!isTxHash(hash)) {
    throw new Error("usage: pnpm verify <64 hex character transaction hash>");
  }

  const net = network();
  const report = parseTxReport(await fetchTx(net.rest, hash));

  console.log(`tx:        ${hash}`);
  console.log(`height:    ${report.height}`);
  console.log(`result:    code ${report.code}${report.code === 0 ? " (success)" : " (failed)"}`);
  console.log(`messages:  ${report.messages.join(", ") || "none"}`);
  console.log(`extension: ${report.extensionTypes.join(", ") || "none"}`);
  console.log(`classical signature (secp256k1): ${report.classicalSignatureBytes ?? "not found"} bytes`);
  console.log(`post-quantum signature (ML-DSA-87): ${report.pqcSignatureBytes ?? "not found"} bytes`);
  console.log(`chain verdict (pqc_hybrid_verify): ${report.pqcVerifyStatus ?? "no event"}`);

  if (report.code !== 0 || report.pqcVerifyStatus !== "verified") {
    throw new Error("the chain did not verify this transaction's hybrid signature");
  }
  console.log("verdict:   hybrid signature verified on chain");
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
