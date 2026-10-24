import { createReadClient } from "@/lib/casper/read";
import { decodeBool, decodeU256, readOdraValue, resolveContractHash } from "@/lib/casper/odraRead";

/**
 * The owner's spending envelope, read straight from AgentTreasury storage.
 *
 * Odra numbers fields from 1 in declaration order; the indices below were read
 * back from live storage (sdk/scripts/calibrate-treasury.mts) and v2 only
 * appended fields, so they carried over. The dictionary keys are the blake2b
 * hashes of those indices, precomputed so this module needs no hashing.
 */

const KEY = {
  dailyLimit: "91ebc8750adaa8b425af368d579f9636248c55fc16a36c3d7df942f03cedd49e", // idx 5
  perTaskLimit: "b6c377c588b78bf5abaa8a3829ce9fe6989dce6c738fccfb896b66eacaaf6b6d", // idx 6
  minReputation: "29ab38a28e1aa51cfcb28d67da03a6388d5918a2a3c48f47e588f5dd1ab52102", // idx 8
  locked: "ce02144de84a5ea7c00b29090a11d8ca27f5763402d08a1ffaa6f5a2e2c8b57a", // idx 14
  paused: "11e1c41445604d2b1d46f886d59c10676bc76c4b05b3b402be18c197ff94c548", // idx 15
} as const;

export interface Envelope {
  /** Ceiling for a single task id, in token base units. */
  perTaskLimit: string;
  /** Ceiling over any rolling 24 hours. */
  dailyLimit: string;
  /** Counterparty bar: a non-whitelisted payee needs at least this score. */
  minReputation: number;
  /** Funds committed to open reservations — unavailable to spend. */
  locked: string;
  /** The owner's brake: while true, every payment and new reservation reverts. */
  paused: boolean;
}

/** The AgentTreasury package the envelope is read from. */
export function treasuryPackage(): string {
  return createReadClient().cfg.packages.treasury;
}

/** Reads the live envelope. Absent keys decode to zero, which is what Odra means by them. */
export async function getEnvelope(): Promise<Envelope> {
  const { rpc, cfg } = createReadClient();
  const contractHash = await resolveContractHash(rpc, cfg.packages.treasury);

  const [perTask, daily, minRep, locked, paused] = await Promise.all([
    readOdraValue(rpc, contractHash, KEY.perTaskLimit),
    readOdraValue(rpc, contractHash, KEY.dailyLimit),
    readOdraValue(rpc, contractHash, KEY.minReputation),
    readOdraValue(rpc, contractHash, KEY.locked),
    readOdraValue(rpc, contractHash, KEY.paused),
  ]);

  return {
    perTaskLimit: decodeU256(perTask).toString(),
    dailyLimit: decodeU256(daily).toString(),
    minReputation: Number(decodeU256(minRep)),
    locked: decodeU256(locked).toString(),
    paused: decodeBool(paused),
  };
}
