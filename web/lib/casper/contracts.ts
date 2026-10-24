/**
 * The deployed set on `casper-test` (v2, 2026-10-23). Shared by the dashboard's
 * proof panel, the site footer and the relay's allow-list — one list, so a
 * redeploy can never leave one of them lying.
 *
 * Client components import this, so it cannot pull the SDK in; contracts.test.ts
 * keeps it equal to the SDK's CASPER_TEST.packages, which the server reads with.
 */
export const CONTRACTS = [
  { name: "AgentVaults", pkg: "4172ebf4438b14ac02dea598d62a95ec05bd6ea717426dc525209ae33b62eafd" },
  { name: "IdentityRegistry", pkg: "941380ecfa5771630eae4bf38f81c0801cfba085799932f55c094f43c0f44953" },
  { name: "ReputationEngine", pkg: "276ae7d8d73b1c0c7e993b068d5cea50508b0a00848b06286530ed27fbe943fa" },
  { name: "Escrow", pkg: "644486bf5b57376b3855157db10da977e61ab300867248c58dd15f33eb45ec27" },
  { name: "AgentTreasury", pkg: "ef14ceacbb8cc6d20cf55225295a4f3d6e5ac5a996c94ad5fc56108337acda24" },
  { name: "Cep18 (AGT)", pkg: "f962076e6c2ba423aaade9f75935ff37ef4aa4cde6077bac9a259af141c3d5c6" },
] as const;

export const contractUrl = (pkg: string) => `https://testnet.cspr.live/contract-package/${pkg}`;
