/**
 * Prove multi-tenant vaults on-chain: one contract, separate accounts.
 *
 *   1. open a vault with our own rules      → returns a vault id
 *   2. approve + deposit into it            → the vault holds its own balance
 *   3. pay a vendor with a track record     → settles
 *   4. pay a vendor without one             → refused (PayeeNotAllowed)
 *   5. freeze, pay again                    → refused (Frozen)
 *
 * Everything is signed by the deployer key, which becomes this vault's owner AND
 * its agent — the self-managed case the dashboard opens with.
 *
 * Run: npx vite-node scripts/vault-probe.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { PrivateKey, KeyAlgorithm, Args, CLValue, Key, ContractCallBuilder, type Transaction } from "casper-js-sdk";
import { CASPER_TEST } from "../src/config.js";
import { makeRpcClient } from "../src/rpc/client.js";

const VAULTS_PKG = "674cc233514a5e478f84ea37d657cc6b58d41984b788778d6ca554e6615d6914";
const CALL_GAS = 5_000_000_000;
const BIG_GAS = 15_000_000_000;

const cfg = CASPER_TEST;
const rpc = makeRpcClient(cfg);
const sk = PrivateKey.fromPem(
  readFileSync(process.env.CASPER_SECRET_KEY_PEM!, "utf8"),
  KeyAlgorithm.SECP256K1,
);

const ERRORS: Record<string, string> = {
  "1": "NotOwner",
  "2": "NotAgent",
  "4": "VaultNotFound",
  "5": "PayeeNotAllowed — no track record and not on the allow-list",
  "6": "ExceedsJobLimit",
  "7": "ExceedsDailyLimit",
  "8": "InsufficientBalance",
  "9": "Frozen — the owner stopped it",
  "10": "VaultAlreadyExists",
};

const link = (h: string) => `https://testnet.cspr.live/transaction/${h}`;

function call(pkg: string, entry: string, args: Args, gas = CALL_GAS): Transaction {
  const tx = new ContractCallBuilder()
    .from(sk.publicKey)
    .byPackageHash(pkg)
    .entryPoint(entry)
    .runtimeArgs(args)
    .chainName(cfg.chainName)
    .payment(gas)
    .build();
  tx.sign(sk);
  return tx;
}

async function submit(step: string, tx: Transaction) {
  const hash = tx.hash.toHex();
  console.log(`\n=== ${step} ===`);
  console.log(link(hash));
  await rpc.putTransaction(tx);
  const res: any = await rpc.waitForTransaction(tx, 180_000);
  const exec = res?.executionInfo?.executionResult;
  const err: string | undefined = exec?.errorMessage ?? exec?.v1?.errorMessage;
  if (err) {
    const code = err.match(/User error: (\d+)/)?.[1];
    console.log(`REVERTED — ${err}${code && ERRORS[code] ? `  (${ERRORS[code]})` : ""}`);
  } else {
    console.log("SUCCESS");
  }
  await sleep(3500);
  return { hash, err };
}

const u256 = (n: bigint) => CLValue.newCLUInt256(n.toString());

async function main() {
  console.log("vaults contract:", VAULTS_PKG);
  console.log("owner + agent  :", sk.publicKey.toHex(), "\n");

  const PER_JOB = 100_000_000_000n; // 100 AGT
  const PER_DAY = 500_000_000_000n; // 500 AGT
  const DEPOSIT = 50_000_000_000n; // 50 AGT

  // 1. Open our own vault, with our own rules.
  await submit(
    "1 · OPEN VAULT (per job 100, per day 500, needs a track record)",
    call(
      VAULTS_PKG,
      "open_vault",
      Args.fromMap({
        agent: CLValue.newCLKey(Key.newKey(`account-hash-${sk.publicKey.accountHash().toHex().replace(/^account-hash-/, "")}`)),
        per_job: u256(PER_JOB),
        per_day: u256(PER_DAY),
        min_track_record: u256(1n),
      }),
      BIG_GAS,
    ),
  );

  // 2. Fund it: approve then deposit.
  await submit(
    "2a · APPROVE the vaults contract to move AGT",
    call(
      cfg.packages.cep18,
      "approve",
      Args.fromMap({
        spender: CLValue.newCLKey(Key.newKey("hash-" + VAULTS_PKG)),
        amount: u256(DEPOSIT),
      }),
    ),
  );
  await submit(
    "2b · DEPOSIT into vault 0",
    call(
      VAULTS_PKG,
      "deposit",
      Args.fromMap({ vault_id: CLValue.newCLUInt32(0), amount: u256(DEPOSIT) }),
      BIG_GAS,
    ),
  );

  // 3-5. The rules, exercised.
  const paid = await submit(
    "3 · PAY vendor #0 (has a track record) — expect SUCCESS",
    call(
      VAULTS_PKG,
      "pay",
      Args.fromMap({
        vault_id: CLValue.newCLUInt32(0),
        task_id: CLValue.newCLUint64("1"),
        payee: CLValue.newCLUInt32(0),
        amount: u256(1_000_000_000n), // 1 AGT
      }),
      BIG_GAS,
    ),
  );

  const refused = await submit(
    "4 · PAY vendor #7 (no track record) — expect REVERT 5",
    call(
      VAULTS_PKG,
      "pay",
      Args.fromMap({
        vault_id: CLValue.newCLUInt32(0),
        task_id: CLValue.newCLUint64("2"),
        payee: CLValue.newCLUInt32(7),
        amount: u256(1_000_000_000n),
      }),
      BIG_GAS,
    ),
  );

  await submit("5a · FREEZE the vault", call(VAULTS_PKG, "freeze", Args.fromMap({ vault_id: CLValue.newCLUInt32(0) })));
  const frozen = await submit(
    "5b · PAY vendor #0 again — expect REVERT 9 (Frozen)",
    call(
      VAULTS_PKG,
      "pay",
      Args.fromMap({
        vault_id: CLValue.newCLUInt32(0),
        task_id: CLValue.newCLUint64("3"),
        payee: CLValue.newCLUInt32(0),
        amount: u256(1_000_000_000n),
      }),
      BIG_GAS,
    ),
  );
  await submit("5c · UNFREEZE", call(VAULTS_PKG, "unfreeze", Args.fromMap({ vault_id: CLValue.newCLUInt32(0) })));

  console.log("\n======== SUMMARY ========");
  console.log(`pay with track record : ${paid.err ? "REVERTED " + paid.err : "SUCCESS"}\n   ${link(paid.hash)}`);
  console.log(`pay without           : ${refused.err ? "REVERTED " + refused.err : "SUCCESS"}\n   ${link(refused.hash)}`);
  console.log(`pay while frozen      : ${frozen.err ? "REVERTED " + frozen.err : "SUCCESS"}\n   ${link(frozen.hash)}`);
}

main().catch((e) => {
  console.error(String(e?.stack ?? e));
  process.exitCode = 1;
});
