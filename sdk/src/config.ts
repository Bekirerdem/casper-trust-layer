export interface NetworkConfig {
  rpcUrl: string;
  authToken?: string;
  chainName: string;
  facilitatorUrl: string;
  packages: { identity: string; reputation: string; escrow: string; cep18: string };
  /** Odra field indices — CALIBRATED against live data in Task 3, not assumed from source. */
  fields: {
    identity: { agents: number; count: number };
    reputation: { reps: number; pairs: number };
    escrow: { jobs: number; count: number };
  };
}

export const CASPER_TEST: NetworkConfig = {
  rpcUrl: process.env.CSPR_CLOUD_TOKEN
    ? "https://node.testnet.cspr.cloud/rpc"
    : "https://node.testnet.casper.network/rpc",
  authToken: process.env.CSPR_CLOUD_TOKEN,
  chainName: "casper-test",
  facilitatorUrl: "https://x402-facilitator.cspr.cloud",
  packages: {
    identity: "3a51cc5f4c524f806b3b8899039030bbad141005f81ab99895615d8f050c7adc",
    reputation: "d73fb11144c07ec05071cf986ad65b407f2da91bd871b0c10f67a974832ee7eb",
    escrow: "fe6b0ddb307549cc9101659abcfaf114e37a8d99461c0632cbce582ebdc4902c",
    cep18: "f962076e6c2ba423aaade9f75935ff37ef4aa4cde6077bac9a259af141c3d5c6",
  },
  // PLACEHOLDER indices from source order; Task 3 overwrites these with live-verified values.
  fields: {
    identity: { agents: 2, count: 3 },
    reputation: { reps: 3, pairs: 4 },
    escrow: { jobs: 3, count: 4 },
  },
};
