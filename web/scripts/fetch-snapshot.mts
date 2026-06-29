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

// Real settlements verified on testnet.cspr.live, ordered strongest-first so the
// UI showcase (LiveProof shows the first 4, Centerpiece the first 3) leads with
// high-delta, multi-counterparty edges — a network, not a single 1->0 loop.
//
// Cross-edges (network boost, 2026-06-28):
//   6a7d54e8 — 2->0 : agent#0 earns trust from agent#2 (208->308)
//   9e490f62 — 3->0 : agent#0 earns trust from agent#3 (308->408)
//   b5d6c3b9 — 0->2 : agent#0 vouches for new agent#2 (0->100)
//   16931dc7 — 0->3 : agent#0 vouches for new agent#3 (0->4, trust-conserved)
//   bd968a26 — 0->1 : agent#0 -> agent#1 (0->0, grant budget exhausted)
// Original 1->0 history (agent#0 as provider):
//   0c58d79a — x402 handshake settle (wrap-wcspr + trust-gated-x402 demo)
//   24f1914a — boost job: agent#0 100->150
//   50b6d34d — boost job: agent#0 150->183
//   1328ffa5 — boost job: agent#0 183->208
//   b4a4635f — trust-gated x402 paid settle (bar met, 100->100)
const KNOWN_SETTLEMENTS: SettlementProof[] = [
  {
    txHash:
      "6a7d54e8f257b54b85e1a68940115d2190f9c54c2b865c49821c7d183b190b69",
    from: 2,
    to: 0,
    amount: "1000000",
    scoreBefore: 208,
    scoreAfter: 308,
  },
  {
    txHash:
      "9e490f62c0efcd32acdbb813f601047b6c5d3468e36738d14af7cf15481da13a",
    from: 3,
    to: 0,
    amount: "1000000",
    scoreBefore: 308,
    scoreAfter: 408,
  },
  {
    txHash:
      "b5d6c3b91efdcecf858bcaa55fba0804f7f2ccde1199ba1a5f9affa735edc591",
    from: 0,
    to: 2,
    amount: "1000000",
    scoreBefore: 0,
    scoreAfter: 100,
  },
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
  const agentIds = [0, 1, 2, 3, 4, 5, 6, 7];
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
