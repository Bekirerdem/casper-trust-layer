export interface NetworkConfig {
  rpcUrl: string;
  authToken?: string;
  chainName: string;
  facilitatorUrl: string;
  packages: { identity: string; reputation: string; escrow: string; cep18: string };
  /** Odra field indices — CALIBRATED against live data in Task 3, not assumed from source. */
  fields: {
    identity: { escrowVarIndex: number; agents: number; count: number };
    reputation: { escrowVarIndex: number; identityVarIndex: number; reps: number; pairs: number };
    escrow: { identityVarIndex: number; reputationVarIndex: number; tokenVarIndex: number; jobs: number; count: number };
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
  // Indices CALIBRATED live against testnet in Task 3 — uniform +1 offset from source order.
  // Evidence: all three contracts store the admin Address at live idx 0; declared fields
  // shift up by 1.  See task-3-report.md for the full scan log.
  fields: {
    //                      source-order  →  live idx (offset +1 confirmed on all 3 contracts)
    identity: {
      escrowVarIndex: 2,  // source 1 → live 2
      agents: 3,          // Mapping source 2 → live 3
      count: 4,           // source 3 → live 4
    },
    reputation: {
      escrowVarIndex: 2,    // source 1 → live 2
      identityVarIndex: 3,  // source 2 → live 3
      reps: 4,              // Mapping source 3 → live 4
      pairs: 5,             // Mapping source 4 → live 5
    },
    escrow: {
      identityVarIndex: 1,    // source 0 → live 1
      reputationVarIndex: 2,  // source 1 → live 2
      tokenVarIndex: 3,       // source 2 → live 3
      jobs: 4,                // Mapping source 3 → live 4
      count: 5,               // source 4 → live 5
    },
  },
};
