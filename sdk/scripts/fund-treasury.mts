/**
 * Fund the AgentTreasury with AGT so the "approved" side of the demo can settle.
 *
 * The probe showed the envelope is enforced but empty: a proven payee cleared the
 * reputation gate and then hit InsufficientFreeBalance. This transfers CEP-18
 * funds from the deployer's supply into the treasury, then re-runs the payment
 * to confirm it settles.
 *
 * Odra resolves `self.env().self_address()` to the contract's PACKAGE address, so
 * that is the transfer recipient. If the follow-up payment still reverts with
 * error 8, the funds landed somewhere the contract cannot see and we retry
 * against the contract hash instead.
 *
 * Run: AMOUNT_AGT=10 npx vite-node scripts/fund-treasury.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { PrivateKey, KeyAlgorithm, type Transaction } from "casper-js-sdk";
import { CASPER_TEST } from "../src/config.js";
import { makeRpcClient } from "../src/rpc/client.js";
import { buildTransferToken, buildTreasuryPay } from "../src/registry/index.js";

const cfg = CASPER_TEST;
const rpc = makeRpcClient(cfg);
const sk = PrivateKey.fromPem(
  readFileSync(process.env.CASPER_SECRET_KEY_PEM!, "utf8"),
  KeyAlgorithm.SECP256K1,
);

const AGT = BigInt(Math.round(Number(process.env.AMOUNT_AGT ?? "10") * 1e9));
const link = (h: string) => `https://testnet.cspr.live/transaction/${h}`;

async function submit(label: string, tx: Transaction) {
  const hash = tx.hash.toHex();
  console.log(`\n=== ${label} ===`);
  console.log(link(hash));
  await rpc.putTransaction(tx);
  const res: any = await rpc.waitForTransaction(tx, 180_000);
  const exec = res?.executionInfo?.executionResult;
  const err: string | undefined = exec?.errorMessage ?? exec?.v1?.errorMessage;
  console.log(err ? `REVERTED — ${err}` : "SUCCESS");
  return { hash, err };
}

async function main() {
  console.log(`funding treasury with ${Number(AGT) / 1e9} AGT`);

  await submit(
    "TRANSFER AGT -> treasury package",
    buildTransferToken(cfg, sk, cfg.packages.treasury, AGT),
  );
  await sleep(4000);

  const pay = await submit(
    "PAY payee #0 (508 bps) — should settle now",
    buildTreasuryPay(cfg, sk, { taskId: 1n, payee: 0, amount: 1_000_000n }),
  );

  if (pay.err?.includes("User error: 8")) {
    console.log(
      "\nStill unfunded from the contract's view — self_address() is not the package.",
    );
    console.log("Retrying the transfer against the contract hash…");
    const contractHash =
      "e3080e2401ab0cedf4e9ab124d4419f9052520e409d5e0d635f18b4bc93e9173";
    await submit(
      "TRANSFER AGT -> treasury contract",
      buildTransferToken(cfg, sk, contractHash, AGT),
    );
    await sleep(4000);
    await submit(
      "PAY payee #0 (retry)",
      buildTreasuryPay(cfg, sk, { taskId: 1n, payee: 0, amount: 1_000_000n }),
    );
  }
}

main().catch((e) => {
  console.error(String(e?.stack ?? e));
  process.exitCode = 1;
});
