/**
 * Probe AgentTreasury.pay() live: does the envelope actually enforce itself?
 *
 * Two attempts against the SAME treasury, differing only in the payee:
 *   #0 — 508 bps, clears the min_reputation = 1 bar   → expect SUCCESS
 *   #7 — 0 bps, registered from a wallet we don't own → expect REVERT (error 5)
 *
 * Error codes (contracts/src/treasury.rs):
 *   3 ZeroAmount · 4 PayeeNotWhitelisted · 5 BelowReputationThreshold
 *   6 ExceedsTaskLimit · 7 ExceedsDailyLimit · 8 InsufficientFreeBalance
 *
 * Run: npx vite-node scripts/treasury-probe.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { PrivateKey, KeyAlgorithm, type Transaction } from "casper-js-sdk";
import { CASPER_TEST } from "../src/config.js";
import { makeRpcClient } from "../src/rpc/client.js";
import { buildTreasuryPay } from "../src/registry/index.js";

const cfg = CASPER_TEST;
const rpc = makeRpcClient(cfg);
const sk = PrivateKey.fromPem(
  readFileSync(process.env.CASPER_SECRET_KEY_PEM!, "utf8"),
  KeyAlgorithm.SECP256K1,
);

const AMOUNT = 1_000_000n; // 0.001 AGT (9 decimals)
const ERRORS: Record<string, string> = {
  "3": "ZeroAmount",
  "4": "PayeeNotWhitelisted — no whitelist entry and no reputation policy",
  "5": "BelowReputationThreshold — payee's score is under the owner's bar",
  "6": "ExceedsTaskLimit — over the per-task cap",
  "7": "ExceedsDailyLimit — over the UTC daily cap",
  "8": "InsufficientFreeBalance — treasury has no unlocked funds",
};

const link = (h: string) => `https://testnet.cspr.live/transaction/${h}`;

async function attempt(label: string, taskId: bigint, payee: number) {
  console.log(`\n======== ${label} · pay(task ${taskId}, payee #${payee}, 0.001 AGT) ========`);
  const tx: Transaction = buildTreasuryPay(cfg, sk, { taskId, payee, amount: AMOUNT });
  const hash = tx.hash.toHex();
  console.log(`tx: ${link(hash)}`);
  await rpc.putTransaction(tx);
  const res: any = await rpc.waitForTransaction(tx, 180_000);
  const exec = res?.executionInfo?.executionResult;
  const err: string | undefined = exec?.errorMessage ?? exec?.v1?.errorMessage;
  if (err) {
    const code = err.match(/User error: (\d+)/)?.[1];
    console.log(`RESULT: REVERTED — ${err}`);
    if (code && ERRORS[code]) console.log(`        meaning: ${ERRORS[code]}`);
  } else {
    console.log("RESULT: SUCCESS — funds left the envelope");
  }
  return { hash, err };
}

async function main() {
  console.log("treasury:", cfg.packages.treasury);
  console.log("signer  :", sk.publicKey.toHex());

  const ok = await attempt("A · proven counterparty", 1n, 0);
  await sleep(4000);
  const bad = await attempt("B · unproven counterparty", 2n, 7);

  console.log("\n======== SUMMARY ========");
  console.log(`A (payee #0, 508 bps): ${ok.err ? "REVERTED — " + ok.err : "SETTLED"}`);
  console.log(`   ${link(ok.hash)}`);
  console.log(`B (payee #7, 0 bps)  : ${bad.err ? "REVERTED — " + bad.err : "SETTLED"}`);
  console.log(`   ${link(bad.hash)}`);
  console.log(
    "\nIf A reverted with error 8, the treasury holds no AGT and needs funding first.",
  );
}

main().catch((e) => {
  console.error(String(e?.stack ?? e));
  process.exitCode = 1;
});
