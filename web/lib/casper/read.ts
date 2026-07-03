import {
  createTrustClient as sdkCreateTrustClient,
  getReputation as sdkGetReputation,
  getAgent as sdkGetAgent,
  type TrustClient,
} from "casper-trust";
import type { AgentSnapshot } from "./types";

export type ReadClient = TrustClient;

/**
 * Create a wallet-free read-only client pointing at casper-test.
 *
 * Uses the official PUBLIC testnet node: the token-gated cspr.cloud endpoint
 * has a daily quota that, once exhausted (2026-07-03), took the whole live
 * layer down with 429s. The public node needs no token and no quota.
 */
export function createReadClient(): ReadClient {
  return sdkCreateTrustClient({
    rpcUrl: "https://node.testnet.casper.network/rpc",
    authToken: undefined,
  });
}

/**
 * Fetch one agent's reputation from the live testnet and return a
 * serializable AgentSnapshot (bigint → number).
 */
export async function getReputation(
  client: ReadClient,
  agentId: number,
): Promise<AgentSnapshot> {
  const [rep, agent] = await Promise.all([
    sdkGetReputation(client, agentId),
    sdkGetAgent(client, agentId),
  ]);

  return {
    agentId,
    scoreBps: Number(rep.scoreBps),
    jobsCompleted: Number(rep.jobsCompleted),
    exists: agent !== null,
  };
}
