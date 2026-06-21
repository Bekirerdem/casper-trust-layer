/**
 * Read-only CSPR balance check for the signer wallet.
 * No gas spent. Run: npx vite-node scripts/check-balance.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrivateKey, KeyAlgorithm, PurseIdentifier } from "casper-js-sdk";
import { CASPER_TEST } from "../src/config.js";
import { makeRpcClient } from "../src/rpc/client.js";

const cfg = CASPER_TEST;
const rpc = makeRpcClient(cfg);
const sk = PrivateKey.fromPem(
  readFileSync(process.env.CASPER_SECRET_KEY_PEM!, "utf8"),
  KeyAlgorithm.SECP256K1,
);

async function main() {
  console.log(`signer: ${sk.publicKey.toHex()}`);
  console.log(`account-hash: ${sk.publicKey.accountHash().toHex()}`);
  console.log(`rpc: ${cfg.rpcUrl}`);
  const res = await rpc.queryLatestBalance(PurseIdentifier.fromPublicKey(sk.publicKey));
  const motes = BigInt(res.balance.toString());
  const cspr = Number(motes) / 1e9;
  console.log(`\nBALANCE motes : ${motes}`);
  console.log(`BALANCE CSPR  : ${cspr}`);
}

main().catch((e) => {
  console.log("######## BALANCE CHECK ERROR ########");
  console.log(String(e?.stack ?? e));
  process.exitCode = 1;
});
