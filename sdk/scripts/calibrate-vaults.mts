/**
 * Calibrate AgentVaults storage against live testnet state, and decode vault 0.
 *
 * Declaration order: 0 identity · 1 reputation · 2 token · 3 vaults(M) ·
 * 4 count · 5 owner_index(M) · 6 day_spent(M) · 7 job_spent(M) · 8 allow_list(M)
 * Every other contract here needed a +1 offset, so `count` should read 1 at
 * index 5 and the vault we opened should decode at mapKeyU32(4, 0).
 *
 * Run: npx vite-node scripts/calibrate-vaults.mts
 */
import "dotenv/config";
import { CASPER_TEST } from "../src/config.js";
import { makeRpcClient } from "../src/rpc/client.js";
import { resolvePackage } from "../src/rpc/resolve.js";
import { readOdraValue } from "../src/odra/read.js";
import { varKey, mapKeyU32 } from "../src/odra/keys.js";
import { Reader, u32, uN, addr, bool } from "../src/odra/bytesrepr.js";

const VAULTS_PKG = "674cc233514a5e478f84ea37d657cc6b58d41984b788778d6ca554e6615d6914";

const cfg = CASPER_TEST;
const rpc = makeRpcClient(cfg);
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

async function main() {
  const { contractHash } = await resolvePackage(rpc, VAULTS_PKG);
  console.log(`AgentVaults contract: ${contractHash}\n`);

  console.log("scanning Var slots for `count` (expect 1):");
  for (let idx = 0; idx <= 10; idx++) {
    const raw = await readOdraValue(rpc, contractHash, varKey(idx));
    const note = raw
      ? `${raw.length}B  ${hex(raw).slice(0, 40)}${raw.length === 4 ? `  u32=${u32(new Reader(raw))}` : ""}`
      : "(absent)";
    console.log(`  ${String(idx).padStart(2)} | ${note}`);
    await new Promise((r) => setTimeout(r, 350));
  }

  console.log("\nlooking for vault 0 in the vaults mapping:");
  for (const idx of [3, 4, 5]) {
    const raw = await readOdraValue(rpc, contractHash, mapKeyU32(idx, 0));
    if (!raw) {
      console.log(`  mapping idx ${idx}: (absent)`);
      await new Promise((r) => setTimeout(r, 350));
      continue;
    }
    console.log(`  mapping idx ${idx}: ${raw.length}B  ${hex(raw).slice(0, 60)}…`);
    try {
      const r = new Reader(raw);
      const vault = {
        owner: addr(r),
        agent: addr(r),
        perJob: uN(r).toString(),
        perDay: uN(r).toString(),
        minTrackRecord: uN(r).toString(),
        balance: uN(r).toString(),
        frozen: bool(r),
      };
      console.log("  DECODED →", JSON.stringify(vault, null, 2));
    } catch (e) {
      console.log(`  decode failed: ${(e as Error).message}`);
    }
    await new Promise((r) => setTimeout(r, 350));
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
