/**
 * Build a REAL multi-agent trust network on casper-test.
 *
 * Registers new agents up to TARGET_TOTAL_AGENTS, then settles a configurable
 * list of client->provider EDGES. Each settled job moves the provider's
 * on-chain reputation. Cross-edges (e.g. 2->0) are FRESH for an existing agent,
 * so they escape the per-edge cap that pinned agent#0's repeated 1->0 edge.
 *
 * Ordering matters: bootstrap a new agent as PROVIDER paid by a high-rep CLIENT
 * (0->2) first, so its score rises; then use it as CLIENT (2->0) to boost an
 * existing agent on a fresh edge.
 *
 * Idempotent registration: only registers (TARGET_TOTAL_AGENTS - current).
 * Re-run with the same target + remaining EDGES to resume after a failure.
 *
 * Spends REAL testnet CSPR (~15 CSPR / register, ~20 CSPR / settled edge).
 * Run: TARGET_TOTAL_AGENTS=4 EDGES="0:2" npx vite-node scripts/network-boost.mts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { PrivateKey, KeyAlgorithm, type Transaction } from "casper-js-sdk";
import { CASPER_TEST } from "../src/config.js";
import { makeRpcClient } from "../src/rpc/client.js";
import { resolvePackage } from "../src/rpc/resolve.js";
import { readOdraValue } from "../src/odra/read.js";
import { varKey } from "../src/odra/keys.js";
import { Reader, u32 } from "../src/odra/bytesrepr.js";
import {
  buildRegister,
  buildApproveToken,
  buildCreateJob,
  buildSubmitWork,
  buildApproveJob,
} from "../src/registry/index.js";
import { getReputation } from "../src/trust/index.js";

const cfg = CASPER_TEST;
const rpc = makeRpcClient(cfg);
const c = { rpc, cfg };

const sk = PrivateKey.fromPem(
  readFileSync(process.env.CASPER_SECRET_KEY_PEM!, "utf8"),
  KeyAlgorithm.SECP256K1,
);

const TARGET_TOTAL_AGENTS = Number(process.env.TARGET_TOTAL_AGENTS ?? 4);
const EDGES = (process.env.EDGES ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean)
  .map((e) => {
    const [client, provider] = e.split(":").map((n) => Number(n.trim()));
    return { client, provider };
  });

const JOB_AMOUNT = 1_000_000n; // 0.001 AGT (9 decimals)
const BOND = 10_000_000_000n; // 10 CSPR
const REGISTER_GAS = 15_000_000_000; // proxy_caller purse ops need headroom

const link = (h: string) => `https://testnet.cspr.live/transaction/${h}`;

// cspr.cloud rate-limits bursts (HTTP 429). Backoff + a gap between every tx.
const GAP_MS = 4_000;
async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 6): Promise<T> {
  let delay = 2_000;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      const is429 = msg.includes("429") || msg.toLowerCase().includes("too many requests");
      if (!is429 || attempt >= tries) throw e;
      console.log(`  ${label}: 429 — backoff ${delay}ms (attempt ${attempt}/${tries})`);
      await sleep(delay);
      delay = Math.min(delay * 2, 20_000);
    }
  }
}

interface SubmitResult { hash: string; ok: boolean; err?: string; cost?: string }

async function submit(step: string, tx: Transaction): Promise<SubmitResult> {
  const hash = tx.hash.toHex();
  console.log(`\n=== ${step} ===`);
  console.log(`tx hash: ${hash}`);
  console.log(`explorer: ${link(hash)}`);
  await withRetry("putTransaction", () => rpc.putTransaction(tx));
  console.log("submitted, waiting for finality...");
  const res: any = await withRetry("waitForTransaction", () =>
    rpc.waitForTransaction(tx, 180_000),
  );
  await sleep(GAP_MS);
  const exec = res?.executionInfo?.executionResult;
  const errorMessage: string | undefined = exec?.errorMessage ?? exec?.v1?.errorMessage;
  const cost = exec?.cost?.toString?.() ?? exec?.consumed?.toString?.();
  if (errorMessage) {
    console.log(`RESULT: FAILED — ${errorMessage} (cost: ${cost})`);
    return { hash, ok: false, err: errorMessage, cost };
  }
  console.log(`RESULT: SUCCESS (cost motes: ${cost})`);
  return { hash, ok: true, cost };
}

async function totalAgents(): Promise<number> {
  return withRetry("totalAgents", async () => {
    const { contractHash } = await resolvePackage(rpc, cfg.packages.identity);
    const raw = await readOdraValue(rpc, contractHash, varKey(cfg.fields.identity.count));
    return raw ? u32(new Reader(raw)) : 0;
  });
}
async function jobCount(): Promise<number> {
  return withRetry("jobCount", async () => {
    const { contractHash } = await resolvePackage(rpc, cfg.packages.escrow);
    const raw = await readOdraValue(rpc, contractHash, varKey(cfg.fields.escrow.count));
    return raw ? u32(new Reader(raw)) : 0;
  });
}
const rep = (id: number) => withRetry(`getReputation#${id}`, () => getReputation(c, id));

interface SettleRow {
  txHash: string; from: number; to: number; amount: string;
  scoreBefore: number; scoreAfter: number;
}
const settlements: SettleRow[] = [];
const registered: { id: number; hash: string }[] = [];

function fail(where: string, r: SubmitResult): never {
  console.log(`\n######## BLOCKED at: ${where} ########`);
  console.log(`error: ${r.err}`);
  console.log(`tx: ${link(r.hash)}`);
  printOutputs();
  process.exitCode = 2;
  throw new Error(`BLOCKED: ${where} — ${r.err}`);
}

/** Register one agent; minted id = total_agents before the call. */
async function registerOne(): Promise<void> {
  const id = await totalAgents();
  const r = await submit(
    `REGISTER AGENT #${id} (bond 10 CSPR)`,
    buildRegister(cfg, sk, `ipfs://agent-card-${id}`, BOND, REGISTER_GAS),
  );
  if (!r.ok) return fail(`register agent #${id}`, r);
  const after = await totalAgents();
  console.log(`=> registered agent #${id} (total_agents now ${after})`);
  registered.push({ id, hash: r.hash });
}

/** Settle one client->provider edge; record the provider's score movement. */
async function settleEdge(client: number, provider: number, label: string): Promise<void> {
  if (client === provider) throw new Error(`self-deal edge ${client}->${provider} rejected`);
  const before = await rep(provider);
  const scoreBefore = Number(before.scoreBps);
  console.log(`\n################ ${label}: ${client} -> ${provider} ################`);
  console.log(`pre: provider#${provider} scoreBps=${scoreBefore}, jobs=${before.jobsCompleted}`);

  // CEP-18 approve — escrow pulls JOB_AMOUNT from the wallet (consumed per job).
  const ra = await submit(
    "CEP-18 APPROVE (escrow spends AGT)",
    buildApproveToken(cfg, sk, cfg.packages.escrow, JOB_AMOUNT),
  );
  if (!ra.ok) return fail(`approve token (${label})`, ra);

  // create_job — deadline is Unix MILLISECONDS on this deployment (get_block_time
  // returns ms; a seconds deadline reverts submit_work with DeadlinePassed=6).
  const jobId = BigInt(await jobCount());
  const deadline = Date.now() + 30 * 24 * 3600 * 1000;
  const rcj = await submit(
    "CREATE JOB",
    buildCreateJob(cfg, sk, { clientId: client, provider, amount: JOB_AMOUNT, deadline }),
  );
  if (!rcj.ok) return fail(`create job (${label})`, rcj);
  console.log(`=> job_id = ${jobId}`);

  const rsw = await submit("SUBMIT WORK", buildSubmitWork(cfg, sk, jobId, `ipfs://result-${jobId}`));
  if (!rsw.ok) return fail(`submit work (${label})`, rsw);

  const raj = await submit(
    "APPROVE JOB (SETTLE — pays provider + records reputation)",
    buildApproveJob(cfg, sk, jobId),
  );
  if (!raj.ok) return fail(`approve job (${label})`, raj);

  const after = await rep(provider);
  const scoreAfter = Number(after.scoreBps);
  console.log(`post: provider#${provider} scoreBps=${scoreAfter}, jobs=${after.jobsCompleted} (settle ${raj.hash})`);
  settlements.push({
    txHash: raj.hash, from: client, to: provider,
    amount: JOB_AMOUNT.toString(), scoreBefore, scoreAfter,
  });
}

function printOutputs() {
  console.log("\n---- REGISTERED AGENTS ----");
  for (const r of registered) console.log(`agent #${r.id}: ${link(r.hash)}`);

  console.log("\n---- SETTLEMENT ROWS (for KNOWN_SETTLEMENTS) ----");
  for (const s of settlements) console.log(JSON.stringify(s));
}

async function main() {
  console.log("######## NETWORK BOOST — casper-test ########");
  console.log(`signer: ${sk.publicKey.toHex()}`);
  console.log(`target total agents: ${TARGET_TOTAL_AGENTS}`);
  console.log(`edges: ${EDGES.map((e) => `${e.client}->${e.provider}`).join(", ") || "(none)"}`);

  const start = await totalAgents();
  console.log(`\ntotal_agents (start): ${start}`);

  // 1. Register up to target (idempotent — skips if already at/above target).
  let need = TARGET_TOTAL_AGENTS - start;
  if (need > 0) console.log(`registering ${need} new agent(s)...`);
  else console.log("no new registrations needed.");
  for (let i = 0; i < need; i++) await registerOne();

  // 2. Settle the requested edges.
  let n = 0;
  for (const e of EDGES) {
    n++;
    await settleEdge(e.client, e.provider, `EDGE ${n}/${EDGES.length}`);
  }

  // 3. Final on-chain reputation snapshot of all agents.
  const total = await totalAgents();
  console.log("\n######## FINAL AGENT REPUTATIONS ########");
  const agentRows: { agentId: number; scoreBps: number; jobsCompleted: number; exists: boolean }[] = [];
  for (let id = 0; id < total; id++) {
    const r = await rep(id);
    agentRows.push({
      agentId: id,
      scoreBps: Number(r.scoreBps),
      jobsCompleted: Number(r.jobsCompleted),
      exists: true,
    });
    console.log(`agent #${id}: scoreBps=${r.scoreBps}, jobsCompleted=${r.jobsCompleted}`);
  }
  console.log("\n---- AGENTS JSON (live) ----");
  console.log(JSON.stringify(agentRows, null, 2));

  printOutputs();
}

main().catch((e) => {
  console.log("\n######## SCRIPT ERROR ########");
  console.log(String(e?.stack ?? e));
  if (!process.exitCode) process.exitCode = 1;
});
