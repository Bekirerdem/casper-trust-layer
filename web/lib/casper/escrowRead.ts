import { createReadClient } from "@/lib/casper/read";
import { readOdraValue, resolveContractHash } from "@/lib/casper/odraRead";

/**
 * Minimal Escrow storage read — just enough to learn the next job id.
 */

// blake2b(u32BE(5)) — the Odra dictionary key of Escrow field index 5 (`count`).
// Precomputed with the SDK's varKey(); constant while the contract is frozen.
const ESCROW_COUNT_KEY =
  "91ebc8750adaa8b425af368d579f9636248c55fc16a36c3d7df942f03cedd49e";

/** Reads Escrow.count — the id the NEXT created job will get. */
export async function getNextJobId(): Promise<bigint> {
  const { rpc, cfg } = createReadClient();
  const contractHash = await resolveContractHash(rpc, cfg.packages.escrow);
  const raw = await readOdraValue(rpc, contractHash, ESCROW_COUNT_KEY);
  if (!raw || raw.length < 8) return BigInt(0);
  return new DataView(raw.buffer, raw.byteOffset, 8).getBigUint64(0, true); // u64 LE
}
