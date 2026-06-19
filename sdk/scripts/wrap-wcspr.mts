/**
 * Faz 0 — Wrap CSPR into WCSPR (facilitator's testnet payment token).
 * Calls WCSPR `deposit()` (no inner args) via proxy_caller_with_return.wasm with
 * attached_value = amount to wrap. Spends REAL testnet CSPR.
 *
 * Run: npx vite-node scripts/wrap-wcspr.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  PrivateKey,
  KeyAlgorithm,
  SessionBuilder,
  Args,
  CLValue,
  CLTypeUInt8,
  type Transaction,
} from "casper-js-sdk";
import { CASPER_TEST } from "../src/config.js";
import { makeRpcClient } from "../src/rpc/client.js";

const WCSPR = "3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e";
const WRAP_MOTES = 5_000_000_000n; // 5 CSPR -> 5 WCSPR
const PROXY_GAS = 15_000_000_000; // proxy purse ops + cross-call (register needed this)

const cfg = CASPER_TEST;
const rpc = makeRpcClient(cfg);
const sk = PrivateKey.fromPem(
  readFileSync(process.env.CASPER_SECRET_KEY_PEM!, "utf8"),
  KeyAlgorithm.SECP256K1,
);

function loadProxy(): Uint8Array {
  const d = dirname(fileURLToPath(import.meta.url));
  return new Uint8Array(readFileSync(resolve(d, "../assets/proxy_caller_with_return.wasm")));
}

function buildDeposit(amount: bigint): Transaction {
  // deposit takes no inner runtime args; the attached CSPR is what gets wrapped.
  const innerBytes = Args.fromMap({}).toBytes();
  const innerList = CLValue.newCLList(
    CLTypeUInt8,
    Array.from(innerBytes, (b) => CLValue.newCLUint8(b)),
  );
  const pkgBytes = Uint8Array.from(Buffer.from(WCSPR, "hex"));
  const tx = new SessionBuilder()
    .from(sk.publicKey)
    .wasm(loadProxy())
    .runtimeArgs(
      Args.fromMap({
        package_hash: CLValue.newCLByteArray(pkgBytes),
        entry_point: CLValue.newCLString("deposit"),
        args: innerList,
        attached_value: CLValue.newCLUInt512(amount.toString()),
        amount: CLValue.newCLUInt512(amount.toString()),
      }),
    )
    .chainName(cfg.chainName)
    .payment(PROXY_GAS)
    .build();
  tx.sign(sk);
  return tx;
}

const link = (h: string) => `https://testnet.cspr.live/transaction/${h}`;

async function main() {
  console.log("######## WRAP CSPR -> WCSPR ########");
  console.log(`signer : ${sk.publicKey.toHex()}`);
  console.log(`wcspr  : ${WCSPR}`);
  console.log(`wrap   : ${WRAP_MOTES} motes (${Number(WRAP_MOTES) / 1e9} CSPR)`);

  const tx = buildDeposit(WRAP_MOTES);
  const hash = tx.hash.toHex();
  console.log(`\ntx hash : ${hash}`);
  console.log(`explorer: ${link(hash)}`);
  await rpc.putTransaction(tx);
  console.log("submitted, waiting for finality...");
  const res: any = await rpc.waitForTransaction(tx, 180_000);
  const exec = res?.executionInfo?.executionResult;
  const errorMessage: string | undefined = exec?.errorMessage ?? exec?.v1?.errorMessage;
  const cost = exec?.cost?.toString?.() ?? exec?.consumed?.toString?.();
  if (errorMessage) {
    console.log(`\nRESULT: FAILED — ${errorMessage} (cost: ${cost})`);
    process.exitCode = 2;
    return;
  }
  console.log(`\nRESULT: SUCCESS (cost motes: ${cost})`);
  console.log("✅ 5 WCSPR minted to signer — ready as x402 payment balance.");
}

main().catch((e) => {
  console.log("\n######## SCRIPT ERROR ########");
  console.log(String(e?.stack ?? e));
  process.exitCode = 1;
});
