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
  score: bigint;
  jobsCompleted: bigint;
  status: Agent["status"] | "None";
  bond: bigint;
}
