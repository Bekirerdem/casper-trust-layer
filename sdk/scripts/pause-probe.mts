/**
 * Prove the owner's brake on-chain, end to end.
 *
 *   1. pay a proven counterparty        → settles
 *   2. pause()                          → owner pulls the brake
 *   3. pay the SAME counterparty        → reverts with Paused (error 12)
 *   4. unpause()                        → owner releases it
 *   5. pay again                        → settles
 *
 * Nothing about the payment changes between 1, 3 and 5 — only the owner's
 * decision does. That is the whole point of delegating spend to an agent.
 *
 * Run: npx vite-node scripts/pause-probe.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { PrivateKey, KeyAlgorithm, type Transaction } from "casper-js-sdk";
import { CASPER_TEST } from "../src/config.js";
import { makeRpcClient } from "../src/rpc/client.js";
import { buildTreasuryPay, buildSetPaused } from "../src/registry/index.js";

const cfg = CASPER_TEST;
const rpc = makeRpcClient(cfg);
const sk = PrivateKey.fromPem(
  readFileSync(process.env.CASPER_SECRET_KEY_PEM!, "utf8"),
  KeyAlgorithm.SECP256K1,
);

const PAYEE = Number(process.env.PAYEE ?? "0");
const AMOUNT = 1_000_000n; // 0.001 AGT
const link = (h: string) => `https://testnet.cspr.live/transaction/${h}`;

async function submit(step: string, tx: Transaction) {
  const hash = tx.hash.toHex();
  console.log(`\n=== ${step} ===`);
  console.log(link(hash));
  await rpc.putTransaction(tx);
  const res: any = await rpc.waitForTransaction(tx, 180_000);
  const exec = res?.executionInfo?.executionResult;
  const err: string | undefined = exec?.errorMessage ?? exec?.v1?.errorMessage;
  console.log(err ? `REVERTED — ${err}` : "SUCCESS");
  await sleep(3000);
  return { hash, err };
}

async function main() {
  console.log(`treasury: ${cfg.packages.treasury}`);
  console.log(`payee   : #${PAYEE}\n`);

  const before = await submit(
    "1 · PAY (brake off)",
    buildTreasuryPay(cfg, sk, { taskId: 101n, payee: PAYEE, amount: AMOUNT }),
  );
  const paused = await submit("2 · PAUSE (owner pulls the brake)", buildSetPaused(cfg, sk, true));
  const blocked = await submit(
    "3 · PAY (brake on) — expect Paused, error 12",
    buildTreasuryPay(cfg, sk, { taskId: 102n, payee: PAYEE, amount: AMOUNT }),
  );
  const unpaused = await submit("4 · UNPAUSE", buildSetPaused(cfg, sk, false));
  const after = await submit(
    "5 · PAY (brake off again)",
    buildTreasuryPay(cfg, sk, { taskId: 103n, payee: PAYEE, amount: AMOUNT }),
  );

  console.log("\n======== SUMMARY ========");
  const row = (l: string, r: { hash: string; err?: string }) =>
    console.log(`${l.padEnd(26)} ${r.err ? "REVERTED " + r.err : "SUCCESS"}\n   ${link(r.hash)}`);
  row("1 pay (brake off)", before);
  row("2 pause", paused);
  row("3 pay (brake on)", blocked);
  row("4 unpause", unpaused);
  row("5 pay (brake off)", after);
}

main().catch((e) => {
  console.error(String(e?.stack ?? e));
  process.exitCode = 1;
});
