/**
 * LIVE hero loop for casper-trust against casper-test.
 * Proves success criterion #4: a settlement moves a provider's on-chain reputation,
 * readable wallet-free.
 *
 * Run: npx vite-node scripts/hero-loop.mts
 * Spends REAL testnet CSPR. Budget guarded below.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
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
import { checkTrust, getReputation } from "../src/trust/index.js";

const rpc = makeRpcClient(CASPER_TEST);
const cfg = CASPER_TEST;
const c = { rpc, cfg };

const sk = PrivateKey.fromPem(
  readFileSync(process.env.CASPER_SECRET_KEY_PEM!, "utf8"),
  KeyAlgorithm.SECP256K1,
);

const log: string[] = [];
function L(s = "") {
  console.log(s);
  log.push(s);
}
const link = (h: string) => `https://testnet.cspr.live/transaction/${h}`;

// --- read identity total_agents (count var, field index 4) ---
async function totalAgents(): Promise<number> {
  const { contractHash } = await resolvePackage(rpc, cfg.packages.identity);
  const raw = await readOdraValue(rpc, contractHash, varKey(cfg.fields.identity.count));
  return raw ? u32(new Reader(raw)) : 0;
}
// --- read escrow job count (field index 5) ---
async function jobCount(): Promise<number> {
  const { contractHash } = await resolvePackage(rpc, cfg.packages.escrow);
  const raw = await readOdraValue(rpc, contractHash, varKey(cfg.fields.escrow.count));
  return raw ? u32(new Reader(raw)) : 0;
}

interface SubmitResult { hash: string; ok: boolean; err?: string; cost?: string }

/** Submit a signed tx, wait for finality, report success/failure. */
async function submit(step: string, tx: Transaction): Promise<SubmitResult> {
  const hash = tx.hash.toHex();
  L(`\n=== ${step} ===`);
  L(`tx hash: ${hash}`);
  L(`explorer: ${link(hash)}`);
  await rpc.putTransaction(tx);
  L(`submitted, waiting for finality...`);
  // 180s timeout for confirmation
  const res: any = await rpc.waitForTransaction(tx, 180_000);
  const exec = res?.executionInfo?.executionResult;
  // V2 execution result carries errorMessage + cost/consumed when present.
  const errorMessage: string | undefined = exec?.errorMessage ?? exec?.v1?.errorMessage;
  const cost = exec?.cost?.toString?.() ?? exec?.consumed?.toString?.();
  if (errorMessage) {
    L(`RESULT: FAILED — ${errorMessage} (cost: ${cost})`);
    return { hash, ok: false, err: errorMessage, cost };
  }
  L(`RESULT: SUCCESS (cost motes: ${cost})`);
  return { hash, ok: true, cost };
}

// ---------------------------------------------------------------------------
// Hero loop
// ---------------------------------------------------------------------------
const BOND = 10_000_000_000n; // 10 CSPR
const JOB_AMOUNT = 1_000_000n; // 0.001 AGT (token has 9 decimals)
// Register routes through proxy_caller (session wasm + purse ops + versioned call):
// 3 CSPR ran out of gas live; 15 CSPR headroom to discover the real consumed cost.
const REGISTER_GAS = 15_000_000_000;
const submitted: { step: string; hash: string; ok: boolean }[] = [];

async function main() {
  L("######## HERO LOOP — casper-test ########");
  L(`signer: ${sk.publicKey.toHex()}`);
  L(`account-hash: ${sk.publicKey.accountHash().toHex()}`);
  L(`rpc: ${cfg.rpcUrl}`);

  // ---- Pre-flight ----
  L("\n---- PRE-FLIGHT ----");
  const startAgents = await totalAgents();
  L(`total_agents (start): ${startAgents}`);
  const startJobs = await jobCount();
  L(`job count (start): ${startJobs}`);

  // ---- 1. Register PROVIDER (bond 10 CSPR) ----
  const providerId = startAgents; // minted id = count before register
  const rp = await submit(
    "REGISTER PROVIDER (bond 10 CSPR)",
    buildRegister(cfg, sk, "ipfs://provider-agent-card", BOND, REGISTER_GAS),
  );
  submitted.push({ step: "register-provider", hash: rp.hash, ok: rp.ok });
  if (!rp.ok) return fail("register provider", rp);
  const afterProvider = await totalAgents();
  L(`total_agents after provider register: ${afterProvider} (expected ${startAgents + 1})`);
  L(`=> provider_id = ${providerId}`);

  // ---- 2. Register CLIENT (bond 10 CSPR) ----
  const clientId = afterProvider; // next minted id
  const rc = await submit(
    "REGISTER CLIENT (bond 10 CSPR)",
    buildRegister(cfg, sk, "ipfs://client-agent-card", BOND, REGISTER_GAS),
  );
  submitted.push({ step: "register-client", hash: rc.hash, ok: rc.ok });
  if (!rc.ok) return fail("register client", rc);
  const afterClient = await totalAgents();
  L(`total_agents after client register: ${afterClient} (expected ${afterProvider + 1})`);
  L(`=> client_id = ${clientId}`);

  // ---- 3. CEP-18 approve (client/deployer approves escrow package) ----
  const ra = await submit(
    "CEP-18 APPROVE (escrow spends AGT)",
    buildApproveToken(cfg, sk, cfg.packages.escrow, JOB_AMOUNT),
  );
  submitted.push({ step: "approve-token", hash: ra.hash, ok: ra.ok });
  if (!ra.ok) return fail("approve token", ra);

  // ---- 4. create_job ----
  const jobId = BigInt(startJobs); // first job id = count before create
  const deadline = Math.floor(Date.now() / 1000) + 30 * 24 * 3600; // +30 days
  const rcj = await submit(
    "CREATE JOB",
    buildCreateJob(cfg, sk, {
      clientId,
      provider: providerId,
      amount: JOB_AMOUNT,
      deadline,
    }),
  );
  submitted.push({ step: "create-job", hash: rcj.hash, ok: rcj.ok });
  if (!rcj.ok) return fail("create job", rcj);
  L(`=> job_id = ${jobId}`);

  // ---- 5. submit_work (provider) ----
  const rsw = await submit(
    "SUBMIT WORK",
    buildSubmitWork(cfg, sk, jobId, "ipfs://result"),
  );
  submitted.push({ step: "submit-work", hash: rsw.hash, ok: rsw.ok });
  if (!rsw.ok) return fail("submit work", rsw);

  // ---- 6. approve job (client) — SETTLES ----
  const raj = await submit(
    "APPROVE JOB (SETTLE — pays provider + records reputation)",
    buildApproveJob(cfg, sk, jobId),
  );
  submitted.push({ step: "approve-job", hash: raj.hash, ok: raj.ok });
  if (!raj.ok) return fail("approve job", raj);

  // ---- 7. Verify success criterion #4 (wallet-free read) ----
  L("\n---- VERIFY (wallet-free read) ----");
  const trust = await checkTrust(c, providerId);
  const rep = await getReputation(c, providerId);
  L(`provider ${providerId} checkTrust: ${JSON.stringify(trust, bigintReplacer)}`);
  L(`provider ${providerId} reputation: ${JSON.stringify(rep, bigintReplacer)}`);

  const moved = rep.scoreBps > 0n && rep.jobsCompleted === 1n;
  L(`\nscoreBps > 0: ${rep.scoreBps > 0n} (=${rep.scoreBps})`);
  L(`jobsCompleted == 1: ${rep.jobsCompleted === 1n} (=${rep.jobsCompleted})`);
  L(moved ? "\n✅ SUCCESS #4 PROVEN — reputation moved." : "\n❌ reputation did NOT move as expected.");

  // Summary
  L("\n---- SUBMITTED TX SUMMARY ----");
  for (const s of submitted) L(`${s.ok ? "OK " : "ERR"} ${s.step}: ${link(s.hash)}`);
}

function fail(where: string, r: SubmitResult) {
  L(`\n######## BLOCKED at: ${where} ########`);
  L(`error: ${r.err}`);
  L(`tx: ${link(r.hash)}`);
  L("\n---- SUBMITTED TX SUMMARY ----");
  for (const s of submitted) L(`${s.ok ? "OK " : "ERR"} ${s.step}: ${link(s.hash)}`);
  process.exitCode = 2;
}

function bigintReplacer(_k: string, v: unknown) {
  return typeof v === "bigint" ? v.toString() : v;
}

main().catch((e) => {
  L(`\n######## SCRIPT ERROR ########`);
  L(String(e?.stack ?? e));
  process.exitCode = 1;
});
