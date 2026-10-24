export interface Reputation {
  jobsCompleted: bigint;
  totalVolume: bigint;
  distinctClients: number;
  scoreBps: bigint;
  grantedOutBps: bigint;
}

export interface Agent {
  owner: string;
  wallet: string;
  agentUri: string;
  bond: bigint;
  status: "Active" | "Slashed" | "Withdrawn";
}

export interface TrustResult {
  agentId: number;
  exists: boolean;
  trusted: boolean;
  /** Effective score, as the contracts read it: 0 once slashed or withdrawn. */
  score: bigint;
  jobsCompleted: bigint;
  status: Agent["status"] | "None";
  bond: bigint;
  /** A withdrawal is pending — the escrow and every payment gate treat the agent as inactive. */
  unbonding: boolean;
}

export const JOB_STATES = [
  "Funded",
  "Submitted",
  "Released",
  "Refunded",
  "Accepted",
  "Cancelled",
  "Disputed",
] as const;
export type JobState = (typeof JOB_STATES)[number];

export interface Job {
  clientId: number;
  provider: number;
  amount: bigint;
  resultHash: string;
  /** Unix ms. */
  deadline: bigint;
  state: JobState;
  /** Unix ms of submit_work, 0 before; the dispute window runs from here. */
  submittedAt: bigint;
}
