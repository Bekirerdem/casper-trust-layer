/**
 * The deployed set on `casper-test`. Shared by the dashboard's proof panel and
 * the site footer — one list, so a redeploy can never leave one of them lying.
 */
export const CONTRACTS = [
  { name: "AgentVaults", pkg: "674cc233514a5e478f84ea37d657cc6b58d41984b788778d6ca554e6615d6914" },
  { name: "IdentityRegistry", pkg: "3a51cc5f4c524f806b3b8899039030bbad141005f81ab99895615d8f050c7adc" },
  { name: "ReputationEngine", pkg: "d73fb11144c07ec05071cf986ad65b407f2da91bd871b0c10f67a974832ee7eb" },
  { name: "Escrow", pkg: "fe6b0ddb307549cc9101659abcfaf114e37a8d99461c0632cbce582ebdc4902c" },
  { name: "AgentTreasury", pkg: "95a5cde87caeeee469f6708b4cdbb8ee6b74bf9a50bab429287cc1400ef32f1a" },
  { name: "Cep18 (AGT)", pkg: "f962076e6c2ba423aaade9f75935ff37ef4aa4cde6077bac9a259af141c3d5c6" },
] as const;

export const contractUrl = (pkg: string) => `https://testnet.cspr.live/contract-package/${pkg}`;
