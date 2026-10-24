import { PrivateKey, KeyAlgorithm } from "casper-js-sdk";

/**
 * Loads the demo signer from DEMO_SIGNER_PEM — a low-balance testnet key, not
 * the deployer. It is the wallet of the demo agents (#0–#2), the treasury's
 * delegated agent and the faucet's AGT source, so it signs accept_job /
 * submit_work, treasury payments and faucet transfers. It administers nothing:
 * the deployer that owns the agents and the contracts never leaves the
 * operator's machine.
 */
export function loadServerSigner(): PrivateKey {
  const pem = process.env.DEMO_SIGNER_PEM;
  if (!pem) throw new Error("DEMO_SIGNER_PEM not configured");
  // Tolerate \n-escaped single-line values and invisible junk (BOM/zero-width/CR)
  // that env tooling injects — a PEM is printable ASCII + newlines, nothing else.
  const cleaned = pem
    .replace(/\\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/[^\x20-\x7E\n]/g, "");
  // Each curve's parser rejects the other's PEM, so the first that parses is right.
  for (const algo of [KeyAlgorithm.SECP256K1, KeyAlgorithm.ED25519]) {
    try {
      return PrivateKey.fromPem(cleaned, algo);
    } catch {
      /* try the other curve */
    }
  }
  throw new Error("DEMO_SIGNER_PEM is not a Casper private key");
}
