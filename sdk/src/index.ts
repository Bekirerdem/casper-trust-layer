import { CASPER_TEST, type NetworkConfig } from "./config.js";
import { makeRpcClient } from "./rpc/client.js";

export { checkTrust, getReputation, getAgent, type TrustClient } from "./trust/index.js";
export { pay, gateByTrust, TrustGateError, type PayRequest, type X402TrustClient } from "./x402/index.js";
export {
  buildRegister as register,
  buildAttestSettlement as attestSettlement,
} from "./registry/index.js";
export type { Reputation, Agent, TrustResult } from "./types.js";
export { CASPER_TEST, type NetworkConfig } from "./config.js";

/**
 * Creates a wallet-free read-only trust client for casper-test (or overridden network).
 *
 * Returns { cfg, rpc } — sufficient for checkTrust / getReputation / getAgent.
 * For x402 payments (pay()), construct an X402TrustClient by adding a signer:
 *   const c: X402TrustClient = { ...createTrustClient(), signer };
 */
export function createTrustClient(overrides: Partial<NetworkConfig> = {}) {
  const cfg = { ...CASPER_TEST, ...overrides };
  return { cfg, rpc: makeRpcClient(cfg) };
}
