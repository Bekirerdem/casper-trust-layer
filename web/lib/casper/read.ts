import {
  createTrustClient as sdkCreateTrustClient,
  getReputation as sdkGetReputation,
  getAgent as sdkGetAgent,
  type TrustClient,
} from "casper-trust";
import type { AgentSnapshot } from "./types";

export type ReadClient = TrustClient;

/** Create a wallet-free read-only client pointing at casper-test. */
export function createReadClient(): ReadClient {
  return sdkCreateTrustClient();
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
