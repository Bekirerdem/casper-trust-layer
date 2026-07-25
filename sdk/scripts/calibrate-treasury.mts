/**
 * Calibrate AgentTreasury's Odra field indices against LIVE testnet storage.
 *
 * Odra lays fields out in declaration order, but every other contract in this
 * repo needed a +1 offset that was only discoverable empirically — so we probe
 * a range of indices and print what is actually stored, instead of trusting the
 * source order.
 *
 * Known deployed values (DEPLOYMENT.md) act as the fingerprints we match:
 *   daily_limit    = 500 AGT   = 500_000_000_000
 *   per_task_limit = 100 AGT   = 100_000_000_000
 *   min_reputation = 1
 *   admin / agent / token / identity / rep_registry = 32-byte addresses
 *
 * Run: npx vite-node scripts/calibrate-treasury.mts
 */
import "dotenv/config";
import { CASPER_TEST } from "../src/config.js";
import { makeRpcClient } from "../src/rpc/client.js";
import { resolvePackage } from "../src/rpc/resolve.js";
import { readOdraValue } from "../src/odra/read.js";
import { varKey } from "../src/odra/keys.js";

const TREASURY_PKG =
  "abbdbdfd40fc241983efda0d42efabdc2b919d6b94fe1e2849e98d6e640e763c";

const cfg = CASPER_TEST;
const rpc = makeRpcClient(cfg);

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

/** Little-endian unsigned integer from the first `n` bytes. */
function leUint(b: Uint8Array, n: number): bigint {
  let v = 0n;
  for (let i = n - 1; i >= 0; i--) v = (v << 8n) | BigInt(b[i]);
  return v;
}

/** Odra U256 is CL-encoded: 1 length byte + little-endian magnitude. */
function clU256(b: Uint8Array): bigint | null {
  if (b.length < 1) return null;
  const len = b[0];
  if (len === 0) return 0n;
  if (len > 32 || b.length < 1 + len) return null;
  return leUint(b.slice(1, 1 + len), len);
}

function describe(raw: Uint8Array): string {
  const parts: string[] = [`${raw.length}B`];
  const u256 = clU256(raw);
  if (u256 !== null) parts.push(`U256≈${u256}`);
  if (raw.length === 8) parts.push(`u64=${leUint(raw, 8)}`);
  if (raw.length === 33 || raw.length === 32) parts.push(`addr?=${hex(raw).slice(0, 24)}…`);
  parts.push(hex(raw).slice(0, 48));
  return parts.join("  ");
}

async function main() {
  const { contractHash } = await resolvePackage(rpc, TREASURY_PKG);
  console.log(`AgentTreasury contract hash: ${contractHash}\n`);
  console.log("Declaration order (source):");
  console.log(
    "  0 admin · 1 agent · 2 token · 3 identity · 4 daily_limit · 5 per_task_limit",
  );
  console.log(
    "  6 rep_registry · 7 min_reputation · 8 whitelist(M) · 9 day_spent(M)",
  );
  console.log(
    "  10 task_spent(M) · 11 reservations(M) · 12 next_reservation_id · 13 locked\n",
  );
  console.log("live idx | stored value");
  console.log("---------+-------------------------------------------------");

  for (let idx = 0; idx <= 16; idx++) {
    let out: string;
    try {
      const raw = await readOdraValue(rpc, contractHash, varKey(idx));
      out = raw ? describe(raw) : "(absent — Odra stores type-defaults as missing)";
    } catch (e) {
      out = `ERROR ${(e as Error).message}`;
    }
    console.log(`${String(idx).padStart(8)} | ${out}`);
    await new Promise((r) => setTimeout(r, 400)); // stay under the RPC rate limit
  }

  console.log("\nMatch the fingerprints:");
  console.log("  500000000000 → daily_limit    100000000000 → per_task_limit    1 → min_reputation");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
