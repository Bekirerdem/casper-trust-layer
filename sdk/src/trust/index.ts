import type { RpcClient } from "casper-js-sdk";
import type { NetworkConfig } from "../config.js";
import { resolvePackage } from "../rpc/resolve.js";
import { readOdraValue } from "../odra/read.js";
import { mapKeyU32, mapKeyU64, varKey } from "../odra/keys.js";
import { Reader, u64 } from "../odra/bytesrepr.js";
import { decodeReputation, decodeAgent, decodeJob } from "./decode.js";
import type { Reputation, Agent, Job, TrustResult } from "../types.js";

const ZERO_REP: Reputation = {
  jobsCompleted: 0n,
  totalVolume: 0n,
  distinctClients: 0,
  scoreBps: 0n,
  grantedOutBps: 0n,
};

export interface TrustClient { rpc: RpcClient; cfg: NetworkConfig; }

export async function getReputation(c: TrustClient, agentId: number): Promise<Reputation> {
  const { contractHash } = await resolvePackage(c.rpc, c.cfg.packages.reputation);
  const p = await readOdraValue(c.rpc, contractHash, mapKeyU32(c.cfg.fields.reputation.reps, agentId));
  return p ? decodeReputation(p) : ZERO_REP; // absent = never settled = zero (mirror on-chain default)
}

export async function getAgent(c: TrustClient, agentId: number): Promise<Agent | null> {
  const { contractHash } = await resolvePackage(c.rpc, c.cfg.packages.identity);
  const p = await readOdraValue(c.rpc, contractHash, mapKeyU32(c.cfg.fields.identity.agents, agentId));
  return p ? decodeAgent(p) : null; // absent = agent does not exist
}

/** When a requested withdrawal unlocks (Unix ms), or null when the agent is not unbonding. */
export async function getUnbondReadyAt(c: TrustClient, agentId: number): Promise<bigint | null> {
  const { contractHash } = await resolvePackage(c.rpc, c.cfg.packages.identity);
  const p = await readOdraValue(c.rpc, contractHash, mapKeyU32(c.cfg.fields.identity.unbondReadyAt, agentId));
  const at = p && p.length >= 8 ? u64(new Reader(p)) : 0n;
  return at === 0n ? null : at;
}

/** One escrowed job, or null when the id was never created. */
export async function getJob(c: TrustClient, jobId: bigint): Promise<Job | null> {
  const { contractHash } = await resolvePackage(c.rpc, c.cfg.packages.escrow);
  const p = await readOdraValue(c.rpc, contractHash, mapKeyU64(c.cfg.fields.escrow.jobs, jobId));
  return p ? decodeJob(p) : null;
}

/** Number of jobs ever created — also the id the next `create_job` will return. */
export async function getJobCount(c: TrustClient): Promise<bigint> {
  const { contractHash } = await resolvePackage(c.rpc, c.cfg.packages.escrow);
  const p = await readOdraValue(c.rpc, contractHash, varKey(c.cfg.fields.escrow.count));
  return p && p.length >= 8 ? u64(new Reader(p)) : 0n;
}

/**
 * Mirrors the gate the contracts apply before money moves: the identity must
 * exist, be Active and not be unbonding, and its effective score must clear
 * `minScore`. A slashed or withdrawn agent keeps its history but scores zero.
 */
export async function checkTrust(
  c: TrustClient,
  agentId: number,
  opts: { minScore?: bigint } = {},
): Promise<TrustResult> {
  const [agent, rep, unbondAt] = await Promise.all([
    getAgent(c, agentId),
    getReputation(c, agentId),
    getUnbondReadyAt(c, agentId),
  ]);
  const exists = agent !== null;
  const unbonding = unbondAt !== null;
  const goodStanding = exists && agent!.status === "Active";
  const score = goodStanding ? rep.scoreBps : 0n;
  const min = opts.minScore ?? 0n;
  return {
    agentId,
    exists,
    trusted: goodStanding && !unbonding && score >= min,
    score,
    jobsCompleted: rep.jobsCompleted,
    status: agent?.status ?? "None",
    bond: agent?.bond ?? 0n,
    unbonding,
  };
}
