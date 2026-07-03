import {
  ParamDictionaryIdentifier,
  ParamDictionaryIdentifierContractNamedKey,
  type RpcClient,
} from "casper-js-sdk";
import { createReadClient } from "@/lib/casper/read";

/**
 * Minimal Odra storage read for the Escrow contract — just enough to learn
 * the next job id (the `count` Var). Mirrors the SDK's odra/read.ts; kept
 * local because the web app consumes the published npm SDK, which does not
 * export these internals.
 */

// blake2b(u32BE(5)) — the Odra dictionary key of Escrow field index 5 (`count`).
// Precomputed with the SDK's varKey(); constant while the contract is frozen.
const ESCROW_COUNT_KEY =
  "91ebc8750adaa8b425af368d579f9636248c55fc16a36c3d7df942f03cedd49e";

let cachedEscrowContractHash: string | null = null;

async function escrowContractHash(rpc: RpcClient, packageHashHex: string): Promise<string> {
  if (cachedEscrowContractHash) return cachedEscrowContractHash;
  const pkg = await rpc.queryLatestGlobalState(`hash-${packageHashHex}`, []);
  const versions = pkg.storedValue.contractPackage?.versions;
  if (!versions || versions.length === 0) throw new Error("escrow package has no versions");
  cachedEscrowContractHash = versions[versions.length - 1].contractHash.hash.toHex();
  return cachedEscrowContractHash;
}

async function readOdraValue(
  rpc: RpcClient,
  contractHashHex: string,
  itemKeyHex: string,
): Promise<Uint8Array | null> {
  const contractNamedKey = new ParamDictionaryIdentifierContractNamedKey(
    `hash-${contractHashHex}`,
    "state",
    itemKeyHex,
  );
  const id = new ParamDictionaryIdentifier(undefined, contractNamedKey, undefined, undefined);
  try {
    const res = await rpc.getDictionaryItemByIdentifier(null, id);
    const clHex: string | undefined = res.rawJSON?.stored_value?.CLValue?.bytes;
    if (typeof clHex === "string" && clHex.length > 0) {
      return Uint8Array.from(Buffer.from(clHex, "hex")).slice(4);
    }
    const clBytes = res.storedValue.clValue?.bytes();
    if (!clBytes || clBytes.length < 4) return null;
    return clBytes.slice(4);
  } catch (e) {
    // -32003 (QueryFailed) = key absent (Odra stores type-defaults as missing keys).
    const err = e as { code?: number; statusCode?: number; sourceErr?: { code?: number } };
    const code = err?.code ?? err?.statusCode ?? err?.sourceErr?.code;
    if (code === -32003) return null;
    throw e;
  }
}

/** Reads Escrow.count — the id the NEXT created job will get. */
export async function getNextJobId(): Promise<bigint> {
  const { rpc, cfg } = createReadClient();
  const contractHash = await escrowContractHash(rpc, cfg.packages.escrow);
  const raw = await readOdraValue(rpc, contractHash, ESCROW_COUNT_KEY);
  if (!raw || raw.length < 8) return BigInt(0);
  return new DataView(raw.buffer, raw.byteOffset, 8).getBigUint64(0, true); // u64 LE
}
