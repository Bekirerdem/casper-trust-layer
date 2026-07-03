import { PrivateKey, KeyAlgorithm } from "casper-js-sdk";

/**
 * Loads the server-side operator key (secp256k1 PEM) from the environment.
 * This key owns the demo agents (#0-#3) and the AGT token supply — it signs
 * faucet transfers and provider-side submit_work calls. Testnet-only.
 */
export function loadServerSigner(): PrivateKey {
  const pem = process.env.DEPLOYER_SECRET_PEM;
  if (!pem) throw new Error("DEPLOYER_SECRET_PEM not configured");
  // Tolerate \n-escaped single-line values and invisible junk (BOM/zero-width/CR)
  // that env tooling injects — a PEM is printable ASCII + newlines, nothing else.
  const cleaned = pem
    .replace(/\\r/g, "")
    .replace(/\\n/g, "\n")
    .replace(/[^\x20-\x7E\n]/g, "");
  return PrivateKey.fromPem(cleaned, KeyAlgorithm.SECP256K1);
}
