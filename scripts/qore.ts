/**
 * qore.ts - small shared helpers for the project's own scripts (send, verify).
 *
 * Everything post-quantum is delegated to @qorechain/sdk; this file only
 * holds network constants, the .env account loading pattern from the
 * official window.ts helper, and a reader for transaction records.
 */
import {
  deriveUnifiedAccount,
  isValidRecoveryCode,
  unifiedAccountFromSeed,
  type UnifiedAccount,
} from "@qorechain/sdk";

export const NETWORKS = {
  testnet: {
    chainId: "qorechain-diana",
    rest: "https://api-testnet.qore.host",
    rpc: "https://rpc-testnet.qore.host",
  },
  mainnet: {
    chainId: "qorechain-vladi",
    rest: "https://api.qore.host",
    rpc: "https://rpc.qore.host",
  },
} as const;

export type NetworkName = keyof typeof NETWORKS;

export function network(): (typeof NETWORKS)[NetworkName] {
  const name = (process.env.QORE_NETWORK ?? "testnet") as NetworkName;
  const n = NETWORKS[name];
  if (!n) throw new Error(`QORE_NETWORK must be "testnet" or "mainnet", got "${name}"`);
  return n;
}

/**
 * Load the signing account from .env, the same pattern as scripts/window.ts:
 * either QORE_MNEMONIC, or PRIVATE_KEY together with QORE_PQC_RECOVERY_CODE.
 * Secrets are read here (Node side) only; they never reach the web page.
 */
export async function loadAccount(): Promise<UnifiedAccount> {
  const mnemonic = process.env.QORE_MNEMONIC?.trim();
  if (mnemonic) return deriveUnifiedAccount(mnemonic, 0);

  const key = process.env.PRIVATE_KEY?.trim();
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error("Set QORE_MNEMONIC, or PRIVATE_KEY as 0x followed by 64 hex characters, in .env");
  }
  const recoveryCode = process.env.QORE_PQC_RECOVERY_CODE?.trim();
  if (!recoveryCode) {
    throw new Error("Set QORE_PQC_RECOVERY_CODE in .env (create one with `pnpm window recovery-code`)");
  }
  if (!isValidRecoveryCode(recoveryCode)) {
    throw new Error("QORE_PQC_RECOVERY_CODE is not a valid QRC1 recovery code (check for a typo)");
  }
  return unifiedAccountFromSeed(Uint8Array.from(Buffer.from(key.slice(2), "hex")), { recoveryCode });
}

/** A transaction hash is 64 hex characters; reject anything else early. */
export function isTxHash(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}

/** A QoreChain native address: "qor1" plus 38 bech32 characters. */
export function isQorAddress(value: string): boolean {
  return /^qor1[023456789acdefghjklmnpqrstuvwxyz]{38}$/.test(value);
}

export interface TxReport {
  height: string;
  code: number;
  messages: string[];
  extensionTypes: string[];
  /** Byte length of the classical secp256k1 signature (expect 64). */
  classicalSignatureBytes: number | null;
  /** Byte length of the ML-DSA-87 signature in the extension (expect 4627). */
  pqcSignatureBytes: number | null;
  /** The status attribute of the pqc_hybrid_verify event, if present. */
  pqcVerifyStatus: string | null;
}

/** Byte length of a base64 string, or null when it is not valid base64. */
function base64Bytes(value: string): number | null {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) return null;
  try {
    return Buffer.from(value, "base64").length;
  } catch {
    return null;
  }
}

/** Largest base64 payload of at least `minBytes` anywhere below `node`. */
function largestBase64Below(node: unknown, minBytes: number): number | null {
  let best: number | null = null;
  const visit = (v: unknown): void => {
    if (typeof v === "string") {
      const n = base64Bytes(v);
      if (n !== null && n >= minBytes && (best === null || n > best)) best = n;
    } else if (Array.isArray(v)) {
      v.forEach(visit);
    } else if (v !== null && typeof v === "object") {
      Object.values(v).forEach(visit);
    }
  };
  visit(node);
  return best;
}

/**
 * Read the facts that prove hybrid signing out of a REST transaction record:
 * the result code, the PQCHybridSignature extension, both signature sizes
 * and the chain's own pqc_hybrid_verify verdict.
 */
export function parseTxReport(record: Record<string, any>): TxReport {
  const tx = record.tx ?? {};
  const response = record.tx_response ?? {};
  const body = tx.body ?? {};

  const messages = (body.messages ?? []).map((m: any) => String(m?.["@type"] ?? "unknown"));
  const extensions = body.extension_options ?? [];
  const extensionTypes = extensions.map((e: any) => String(e?.["@type"] ?? "unknown"));

  const firstSignature: string | undefined = (tx.signatures ?? [])[0];
  const classicalSignatureBytes = firstSignature ? base64Bytes(firstSignature) : null;

  // The ML-DSA-87 signature lives inside the PQCHybridSignature extension.
  const pqcExtension = extensions.find((e: any) => String(e?.["@type"] ?? "").includes("PQCHybridSignature"));
  const pqcSignatureBytes = pqcExtension ? largestBase64Below(pqcExtension, 1000) : null;

  const event = (response.events ?? []).find((e: any) => e?.type === "pqc_hybrid_verify");
  const statusAttr = (event?.attributes ?? []).find((a: any) => a?.key === "status");

  return {
    height: String(response.height ?? "?"),
    code: Number(response.code ?? -1),
    messages,
    extensionTypes,
    classicalSignatureBytes,
    pqcSignatureBytes,
    pqcVerifyStatus: statusAttr ? String(statusAttr.value) : null,
  };
}

/** Fetch one transaction record from the public REST endpoint. */
export async function fetchTx(rest: string, hash: string): Promise<Record<string, any>> {
  const res = await fetch(`${rest}/cosmos/tx/v1beta1/txs/${hash}`);
  if (res.status === 404) throw new Error(`transaction ${hash} not found (yet) on this network`);
  if (!res.ok) throw new Error(`transaction query failed: HTTP ${res.status}`);
  return (await res.json()) as Record<string, any>;
}
