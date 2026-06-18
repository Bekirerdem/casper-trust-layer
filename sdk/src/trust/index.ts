import type { RpcClient } from "casper-js-sdk";
import type { NetworkConfig } from "../config.js";
import { resolvePackage } from "../rpc/resolve.js";
import { readOdraValue } from "../odra/read.js";
import { mapKeyU32 } from "../odra/keys.js";
import { decodeReputation, decodeAgent } from "./decode.js";
import type { Reputation, Agent, TrustResult } from "../types.js";

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

export async function checkTrust(
  c: TrustClient,
  agentId: number,
  opts: { minScore?: bigint } = {},
): Promise<TrustResult> {
  const [agent, rep] = await Promise.all([getAgent(c, agentId), getReputation(c, agentId)]);
  const exists = agent !== null;
  const min = opts.minScore ?? 0n;
  const trusted = exists && agent!.status === "Active" && rep.scoreBps >= min;
  return {
    agentId,
    exists,
    trusted,
    score: rep.scoreBps,
    jobsCompleted: rep.jobsCompleted,
    status: agent?.status ?? "None",
    bond: agent?.bond ?? 0n,
  };
}
