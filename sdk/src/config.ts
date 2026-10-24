export interface NetworkConfig {
  rpcUrl: string;
  authToken?: string;
  chainName: string;
  facilitatorUrl: string;
  packages: {
    identity: string;
    reputation: string;
    escrow: string;
    cep18: string;
    treasury: string;
    vaults: string;
  };
  /**
   * Odra field indices. Odra numbers module fields from 1 in declaration order;
   * every index below was read back from live testnet storage, not assumed.
   */
  fields: {
    identity: { escrowVarIndex: number; agents: number; count: number; unbondReadyAt: number };
    reputation: { escrowVarIndex: number; identityVarIndex: number; reps: number; pairs: number };
    escrow: {
      identityVarIndex: number;
      reputationVarIndex: number;
      tokenVarIndex: number;
      jobs: number;
      count: number;
      paused: number;
      fees: number;
    };
    treasury: {
      admin: number;
      agent: number;
      token: number;
      identity: number;
      dailyLimit: number;
      perTaskLimit: number;
      repRegistry: number;
      minReputation: number;
      whitelist: number;
      daySpent: number;
      taskSpent: number;
      locked: number;
      paused: number;
    };
    vaults: { vaults: number; count: number };
  };
}

export const CASPER_TEST: NetworkConfig = {
  rpcUrl: process.env.CSPR_CLOUD_TOKEN
    ? "https://node.testnet.cspr.cloud/rpc"
    : "https://node.testnet.casper.network/rpc",
  authToken: process.env.CSPR_CLOUD_TOKEN,
  chainName: "casper-test",
  facilitatorUrl: "https://x402-facilitator.cspr.cloud",
  // v2 (2026-10-23) — the audited rewrite. Odra has no upgrade path, so this is a
  // fresh install; the v1 packages stay on-chain, unused (see DEPLOYMENT.md).
  packages: {
    identity: "941380ecfa5771630eae4bf38f81c0801cfba085799932f55c094f43c0f44953",
    reputation: "276ae7d8d73b1c0c7e993b068d5cea50508b0a00848b06286530ed27fbe943fa",
    escrow: "644486bf5b57376b3855157db10da977e61ab300867248c58dd15f33eb45ec27",
    cep18: "f962076e6c2ba423aaade9f75935ff37ef4aa4cde6077bac9a259af141c3d5c6",
    treasury: "ef14ceacbb8cc6d20cf55225295a4f3d6e5ac5a996c94ad5fc56108337acda24",
    vaults: "4172ebf4438b14ac02dea598d62a95ec05bd6ea717426dc525209ae33b62eafd",
  },
  // Verified against the v2 install (2026-10-24): identity idx 1 = admin and 2 =
  // the escrow package; escrow 1–3 = identity/reputation/token packages, 6 = admin;
  // treasury 5 = 500 AGT daily cap, 6 = 100 AGT per-task cap. v2 only appended
  // fields, so every v1 index carried over unchanged.
  fields: {
    identity: {
      escrowVarIndex: 2,
      agents: 3,          // Mapping<u32, Agent>
      count: 4,
      unbondReadyAt: 6,   // Mapping<u32, u64> — non-zero while a withdrawal is pending
    },
    reputation: {
      escrowVarIndex: 2,
      identityVarIndex: 3,
      reps: 4,            // Mapping<u32, Reputation>
      pairs: 5,           // Mapping<(u32, u32), PairStat>
    },
    escrow: {
      identityVarIndex: 1,
      reputationVarIndex: 2,
      tokenVarIndex: 3,
      jobs: 4,            // Mapping<u64, Job>
      count: 5,
      paused: 8,
      fees: 9,
    },
    treasury: {
      admin: 1,
      agent: 2,
      token: 3,
      identity: 4,
      dailyLimit: 5,
      perTaskLimit: 6,
      repRegistry: 7,
      minReputation: 8,
      whitelist: 9,   // Mapping<u32, bool>
      daySpent: 10,   // Mapping<u64, U256> keyed by UTC day (display only; the cap is rolling 24h)
      taskSpent: 11,  // Mapping<u64, U256>
      locked: 14,
      paused: 15,
    },
    vaults: {
      vaults: 4,      // Mapping<u32, Vault>
      count: 5,
    },
  },
};
