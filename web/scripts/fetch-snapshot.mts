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

// Known settlements from live demo runs (DEPLOYMENT.md + README.md).
// These are REAL tx hashes verified on testnet.cspr.live:
//   0c58d79a — x402 handshake settle (wrap-wcspr + trust-gated-x402 demo)
//   b4a4635f — trust-gated x402 paid settle (bar met by provider score)
//   24f1914a — boost run job#3: agent#0 score 100->150, jobs 1->2
//   50b6d34d — boost run job#4: agent#0 score 150->183, jobs 2->3
//   1328ffa5 — boost run job#5: agent#0 score 183->208, jobs 3->4
const KNOWN_SETTLEMENTS: SettlementProof[] = [
  {
    txHash:
      "0c58d79ae9c595b4f9615bb505512bfaaf745c0e3da4f0808d6b197bcaec3c6e",
    from: 1,
    to: 0,
    amount: "1000000",
    scoreBefore: 0,
    scoreAfter: 100,
  },
  {
    txHash:
      "b4a4635fd7611396c152d904c402ef9c6fcaa876c83fbf8b1429e1d9fb0225e3",
    from: 1,
    to: 0,
    amount: "1000000",
    scoreBefore: 100,
    scoreAfter: 100,
  },
  {
    txHash:
      "24f1914adcf3915b6abbd69e2c992f251969abf383d278b15f3264218495c154",
    from: 1,
    to: 0,
    amount: "1000000",
    scoreBefore: 100,
    scoreAfter: 150,
  },
  {
    txHash:
      "50b6d34dc3e8f223a50c79bebff697e4dbc1533b3e2799379f81f4fe00c1c275",
    from: 1,
    to: 0,
    amount: "1000000",
    scoreBefore: 150,
    scoreAfter: 183,
  },
  {
    txHash:
      "1328ffa50300aa01e816a010ebbfe15e096f3ae8616f643a42612b55da18e167",
    from: 1,
    to: 0,
    amount: "1000000",
    scoreBefore: 183,
    scoreAfter: 208,
  },
];

async function main() {
  const client = createTrustClient();
  console.log(`rpc: ${client.cfg.rpcUrl}`);

  // Probe a few agent IDs.  The hero-loop registered agents 0+1; scan up to 8
  // to catch any additional registrations on the shared testnet deployer.
  const agentIds = [0, 1, 2, 3];
  const agents: AgentSnapshot[] = [];

  for (const id of agentIds) {
    try {
      const [rep, agent] = await Promise.all([
        getReputation(client, id),
        getAgent(client, id),
      ]);
      if (agent !== null) {
        agents.push({
          agentId: id,
          scoreBps: Number(rep.scoreBps),
          jobsCompleted: Number(rep.jobsCompleted),
          exists: true,
        });
        console.log(`agent #${id}: scoreBps=${rep.scoreBps}, jobs=${rep.jobsCompleted}`);
      }
    } catch (e: unknown) {
      // Agent doesn't exist or RPC error — skip silently
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`agent #${id} skipped: ${msg}`);
    }
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
