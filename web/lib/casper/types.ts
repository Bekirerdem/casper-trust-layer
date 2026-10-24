/**
 * Agents operated by the server's demo signer (sdk/scripts/seed-v2.mts): the
 * only providers the hire flow can complete without the provider's own wallet.
 */
export const DEMO_AGENT_IDS: readonly number[] = [0, 1, 2];

/** Flattened, serializable snapshot of one on-chain agent. */
export type AgentSnapshot = {
  agentId: number;
  scoreBps: number;
  jobsCompleted: number;
  exists: boolean;
};

/** A settlement transaction proof stored in the snapshot. */
export type SettlementProof = {
  txHash: string;
  from: number;
  to: number;
  amount: string;
  scoreBefore: number;
  scoreAfter: number;
};

/** Top-level snapshot of testnet state captured at build time. */
export type TrustSnapshot = {
  capturedAt: string;
  network: "casper-test";
  agents: AgentSnapshot[];
  settlements: SettlementProof[];
};
