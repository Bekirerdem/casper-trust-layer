/**
 * Inspect a Casper contract package's entry points + named keys.
 * Usage: npx vite-node scripts/inspect-token.mts [packageHashHex]
 * Default = facilitator's testnet WCSPR (3d80df21...).
 */
import "dotenv/config";
import { CASPER_TEST } from "../src/config.js";
import { makeRpcClient } from "../src/rpc/client.js";

const PKG =
  process.argv[2] ??
  "3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e";

const rpc = makeRpcClient(CASPER_TEST);

const pkg = await rpc.queryLatestGlobalState(`hash-${PKG}`, []);
const versions = (pkg.storedValue as any).contractPackage?.versions;
if (!versions?.length) {
  console.log("no versions; raw storedValue:");
  console.log(JSON.stringify(pkg.storedValue, null, 2).slice(0, 1500));
  process.exit(0);
}
const contractHash: string = versions[versions.length - 1].contractHash.hash.toHex();
console.log("package :", PKG);
console.log("contract:", contractHash);

const c = await rpc.queryLatestGlobalState(`hash-${contractHash}`, []);
const contract: any = (c.storedValue as any).contract;
const eps = contract?.entryPoints ?? [];
const FOCUS = new Set(["deposit", "withdraw", "transfer_with_authorization", "receive_with_authorization"]);
console.log(`\nentry points (${eps.length}):`);
for (const e of eps) {
  const ep = e.entryPoint ?? e;
  const name = ep.name ?? JSON.stringify(e).slice(0, 80);
  if (FOCUS.has(name)) {
    const args = (ep.args ?? []).map(
      (a: any) => `${a.name}: ${JSON.stringify(a.clType ?? a.cl_type)}`,
    );
    console.log(`  - ${name}(`);
    for (const a of args) console.log(`      ${a}`);
    console.log(`    )`);
  } else {
    console.log("  -", name);
  }
}
const nks = contract?.namedKeys ?? [];
console.log(`\nnamed keys (${nks.length}):`, nks.map((k: any) => k.name).join(", "));

// Read EIP-712 domain-relevant metadata values (name/symbol/decimals/chain_name).
const META = ["name", "symbol", "decimals", "chain_name"];
console.log("\nmetadata values:");
for (const key of META) {
  const nk = nks.find((k: any) => k.name === key);
  if (!nk) {
    console.log(`  ${key}: <no named key>`);
    continue;
  }
  try {
    const r = await rpc.queryLatestGlobalState(nk.key.toPrefixedString(), []);
    const cv: any = (r.storedValue as any).clValue;
    const val = cv?.toString?.() ?? JSON.stringify(cv);
    console.log(`  ${key}: ${val}`);
  } catch (e: any) {
    console.log(`  ${key}: ERR ${e?.message}`);
  }
}
