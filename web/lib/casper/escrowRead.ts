import { blake2b } from "blakejs";
import { createReadClient } from "@/lib/casper/read";
import { readOdraValue, resolveContractHash } from "@/lib/casper/odraRead";

/**
 * Minimal Escrow storage read — the next job id and a single job.
 */

// blake2b(u32BE(5)) — the Odra dictionary key of Escrow field index 5 (`count`).
// Precomputed with the SDK's varKey(); constant while the contract is frozen.
const ESCROW_COUNT_KEY =
  "91ebc8750adaa8b425af368d579f9636248c55fc16a36c3d7df942f03cedd49e";
// Escrow field index 4 (`jobs: Mapping<u64, Job>`).
const ESCROW_JOBS_INDEX = 4;

/** Reads Escrow.count — the id the NEXT created job will get. */
export async function getNextJobId(): Promise<bigint> {
  const { rpc, cfg } = createReadClient();
  const contractHash = await resolveContractHash(rpc, cfg.packages.escrow);
  const raw = await readOdraValue(rpc, contractHash, ESCROW_COUNT_KEY);
  if (!raw || raw.length < 8) return BigInt(0);
  return new DataView(raw.buffer, raw.byteOffset, 8).getBigUint64(0, true); // u64 LE
}

export const JOB_STATES = ["Funded", "Submitted", "Released", "Refunded"] as const;
export type JobState = (typeof JOB_STATES)[number];

export type EscrowJob = {
  clientId: number;
  provider: number;
  amount: bigint;
  resultHash: string;
  deadlineMs: bigint;
  state: JobState;
};

/** Odra mapping key: blake2b(u32BE(field index) ++ u64LE(key)). */
function jobKey(jobId: bigint): string {
  const b = new Uint8Array(12);
  const view = new DataView(b.buffer);
  view.setUint32(0, ESCROW_JOBS_INDEX, false);
  view.setBigUint64(4, jobId, true);
  return Buffer.from(blake2b(b, undefined, 32)).toString("hex");
}

/** Decodes the bytesrepr of `Job { u32, u32, U256, String, u64, JobState }`. */
export function decodeJob(raw: Uint8Array): EscrowJob {
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  let o = 0;
  const clientId = view.getUint32(o, true);
  o += 4;
  const provider = view.getUint32(o, true);
  o += 4;
  const len = raw[o++];
  let amount = BigInt(0);
  for (let i = 0; i < len; i++) amount += BigInt(raw[o + i]) * BigInt(256) ** BigInt(i);
  o += len;
  const strLen = view.getUint32(o, true);
  o += 4;
  const resultHash = Buffer.from(raw.slice(o, o + strLen)).toString("utf8");
  o += strLen;
  const deadlineMs = view.getBigUint64(o, true);
  o += 8;
  const state = JOB_STATES[raw[o]];
  if (!state) throw new Error(`unknown job state ${raw[o]}`);
  return { clientId, provider, amount, resultHash, deadlineMs, state };
}

/** Reads one escrowed job, or null when the id was never created. */
export async function getJob(jobId: bigint): Promise<EscrowJob | null> {
  const { rpc, cfg } = createReadClient();
  const contractHash = await resolveContractHash(rpc, cfg.packages.escrow);
  const raw = await readOdraValue(rpc, contractHash, jobKey(jobId));
  return raw ? decodeJob(raw) : null;
}
