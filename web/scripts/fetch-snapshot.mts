/**
 * Fetch live testnet state and write web/lib/data/snapshot.json.
 *
 * Usage:
 *   npm run snapshot                    # via package.json "snapshot" script
 *   node --import tsx scripts/fetch-snapshot.mts
 *
 * Environment:
 *   CSPR_CLOUD_TOKEN  (optional) — cspr.cloud API key; if absent, falls back
 *                     to the public node (may be rate-limited).
 *
 * If the RPC is unreachable the script exits with a non-zero code and the
 * existing snapshot.json is left untouched.
 */
// Load web/.env if dotenv is installed; otherwise rely on a shell-exported
// CSPR_CLOUD_TOKEN. dotenv is not a hard dependency of the web app.
try {
  await import("dotenv/config");
} catch {
  /* no dotenv — caller must export CSPR_CLOUD_TOKEN in the shell */
}
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createTrustClient, getReputation, getAgent } from "casper-trust";
import type { TrustSnapshot, AgentSnapshot, SettlementProof } from "../lib/casper/types.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "../lib/data/snapshot.json");

// Real v2 settlements (sdk/scripts/seed-v2.mts, 2026-10-24), verifiable on
// testnet.cspr.live. Each went the full v2 way — create, provider accept,
// submit, release — and every edge crosses owners: demo providers #0–#2 belong
// to the deployer, clients #3 and #4 to two other accounts. A same-owner edge
// would have settled for zero reputation.
const KNOWN_SETTLEMENTS: SettlementProof[] = [
  {
    txHash: "1fa8296f1ffb538eb9969dcba74a046a69f15e36bf0173e03efd11afd92c25d8",
    from: 3,
    to: 0,
    amount: "10000000",
    scoreBefore: 0,
    scoreAfter: 316,
  },
  {
    // a second, unrelated client: a fresh edge earns in full
    txHash: "2e09f49fb67eac420342d7bb52b01a04dd8cfaefd44b53e96a79f76f49316550",
    from: 4,
    to: 0,
    amount: "10000000",
    scoreBefore: 316,
    scoreAfter: 632,
  },
  {
    txHash: "39151da9211bfd7e1dbb71f093250eb29c973de1f5cc3c9d6e13b9018d3eaa34",
    from: 3,
    to: 1,
    amount: "10000000",
    scoreBefore: 0,
    scoreAfter: 316,
  },
  {
    txHash: "36c8e43f2bf618357d9c6070f7a725ff6c1f4839006812fc24ba81bb369ea580",
    from: 4,
    to: 2,
    amount: "10000000",
    scoreBefore: 0,
    scoreAfter: 316,
  },
  {
    // a provider paying a client: trust runs both ways across owners
    txHash: "36805dc4e83b05ad4c761de116f4524c0186bce72a19f1614ad40be2efcbd2a8",
    from: 0,
    to: 3,
    amount: "10000000",
    scoreBefore: 0,
    scoreAfter: 316,
  },
  {
    // the same client again: repeat business is dampened to half
    txHash: "19d6466fbcc42ec289b74b36a9277f0668c4e48dd717b3e5619d2fee53f5b3a0",
    from: 3,
    to: 0,
    amount: "10000000",
    scoreBefore: 632,
    scoreAfter: 790,
  },
];

const SCAN_LIMIT = 24;

async function main() {
  const client = createTrustClient();
  console.log(`rpc: ${client.cfg.rpcUrl}`);

  const agents: AgentSnapshot[] = [];
  for (let id = 0; id < SCAN_LIMIT; id++) {
    const [rep, agent] = await Promise.all([getReputation(client, id), getAgent(client, id)]);
    if (agent === null) break; // ids are sequential — first gap = end of registry
    agents.push({
      agentId: id,
      scoreBps: Number(rep.scoreBps),
      jobsCompleted: Number(rep.jobsCompleted),
      exists: true,
    });
    console.log(`agent #${id}: scoreBps=${rep.scoreBps}, jobs=${rep.jobsCompleted}`);
  }

  if (agents.length === 0) {
    console.error("No agents found — check RPC connectivity.");
    process.exitCode = 1;
    return;
  }

  const snapshot: TrustSnapshot = {
    capturedAt: new Date().toISOString(),
    network: "casper-test",
    agents,
    settlements: KNOWN_SETTLEMENTS,
  };

  writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + "\n");
  console.log(`\nWrote ${OUT}`);
  console.log(`  agents: ${agents.length}`);
  console.log(`  settlements: ${snapshot.settlements.length}`);
}

main().catch((e) => {
  console.error(e?.stack ?? e);
  process.exitCode = 1;
});
