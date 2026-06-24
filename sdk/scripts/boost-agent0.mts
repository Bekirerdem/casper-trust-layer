/**
 * Boost the EXISTING agent#0 with 3 real settlements on casper-test.
 * No registration — reuses agent#0 (provider) and agent#1 (client), both owned
 * by the signer wallet. Each loop: CEP-18 approve -> create_job -> submit_work ->
 * approve_job (settles, pays provider, 2% burn, records reputation).
 *
 * Spends REAL testnet CSPR (~12 stored-contract calls x 5 CSPR + buffer).
 * Run: npx vite-node scripts/boost-agent0.mts
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

const PROVIDER_ID = 0; // existing agent#0
const CLIENT_ID = 1; // existing agent#1 (provider_id != client_id — escrow self-deal guard)
const JOB_AMOUNT = 1_000_000n; // 0.001 AGT (9 decimals)
const RUNS = Number(process.env.RUNS ?? 3); // settlements to perform this invocation

const link = (h: string) => `https://testnet.cspr.live/transaction/${h}`;

// cspr.cloud rate-limits bursts (HTTP 429). Wrap RPC calls with backoff and add a
// gap between every transaction to stay under the limit.
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

async function jobCount(): Promise<number> {
  return withRetry("jobCount", async () => {
    const { contractHash } = await resolvePackage(rpc, cfg.packages.escrow);
    const raw = await readOdraValue(rpc, contractHash, varKey(cfg.fields.escrow.count));
    return raw ? u32(new Reader(raw)) : 0;
  });
}

const rep0 = () => withRetry("getReputation", () => getReputation(c, PROVIDER_ID));

interface JobRecord {
  jobId: string;
  settleHash: string;
  amount: string;
  scoreBefore: number;
  scoreAfter: number;
  jobsBefore: number;
  jobsAfter: number;
}

const records: JobRecord[] = [];

async function fail(where: string, r: SubmitResult): Promise<never> {
  console.log(`\n######## BLOCKED at: ${where} ########`);
  console.log(`error: ${r.err}`);
  console.log(`tx: ${link(r.hash)}`);
  printSummary();
  process.exitCode = 2;
  throw new Error(`BLOCKED: ${where} — ${r.err}`);
}

function printSummary() {
  console.log("\n---- SETTLEMENT SUMMARY ----");
  for (const j of records) {
    console.log(
      `job ${j.jobId}: settle ${j.settleHash} | score ${j.scoreBefore}->${j.scoreAfter} | jobs ${j.jobsBefore}->${j.jobsAfter}`,
    );
    console.log(`  ${link(j.settleHash)}`);
  }
}

/**
 * Settle one job and record the reputation movement.
 * If `resumeJobId` is set, the job is already Funded on-chain (a previous run
 * created it but crashed before settling) — skip approve+create_job and just
 * submit_work + approve. Otherwise run the full flow on a fresh job.
 */
async function settleOne(label: string, resumeJobId?: bigint): Promise<void> {
  const repBefore = await rep0();
  const scoreBefore = Number(repBefore.scoreBps);
  const jobsBefore = Number(repBefore.jobsCompleted);
  console.log(`\n################ ${label} ################`);
  console.log(`pre-job: scoreBps=${scoreBefore}, jobsCompleted=${jobsBefore}`);

  let jobId: bigint;
  if (resumeJobId !== undefined) {
    jobId = resumeJobId;
    console.log(`=> resuming existing Funded job_id = ${jobId} (skip approve+create)`);
  } else {
    // CEP-18 approve — escrow needs allowance to pull JOB_AMOUNT (consumed per job).
    const ra = await submit(
      "CEP-18 APPROVE (escrow spends AGT)",
      buildApproveToken(cfg, sk, cfg.packages.escrow, JOB_AMOUNT),
    );
    if (!ra.ok) return fail(`approve token (${label})`, ra);

    // create_job (client locks funds). Casper get_block_time() is Unix MS on this
    // deployment, so the deadline must be MS too. (Live-verified: a seconds deadline
    // reverted submit_work with DeadlinePassed=6 because block_time ms >> deadline s.)
    jobId = BigInt(await jobCount()); // next job id = count before create
    const deadline = Date.now() + 30 * 24 * 3600 * 1000; // +30 days, Unix MILLISECONDS
    const rcj = await submit(
      "CREATE JOB",
      buildCreateJob(cfg, sk, {
        clientId: CLIENT_ID,
        provider: PROVIDER_ID,
        amount: JOB_AMOUNT,
        deadline,
      }),
    );
    if (!rcj.ok) return fail(`create job (${label})`, rcj);
    console.log(`=> job_id = ${jobId}`);
  }

  // submit_work (provider)
  const rsw = await submit(
    "SUBMIT WORK",
    buildSubmitWork(cfg, sk, jobId, `ipfs://result-${jobId}`),
  );
  if (!rsw.ok) return fail(`submit work (${label})`, rsw);

  // approve_job (client) — SETTLES, pays provider, 2% burn, records reputation
  const raj = await submit(
    "APPROVE JOB (SETTLE — pays provider + records reputation)",
    buildApproveJob(cfg, sk, jobId),
  );
  if (!raj.ok) return fail(`approve job (${label})`, raj);

  const repAfter = await rep0();
  const scoreAfter = Number(repAfter.scoreBps);
  const jobsAfter = Number(repAfter.jobsCompleted);
  console.log(
    `post-job: scoreBps=${scoreAfter}, jobsCompleted=${jobsAfter} (settle: ${raj.hash})`,
  );

  records.push({
    jobId: jobId.toString(),
    settleHash: raj.hash,
    amount: JOB_AMOUNT.toString(),
    scoreBefore,
    scoreAfter,
    jobsBefore,
    jobsAfter,
  });
}

async function main() {
  console.log("######## BOOST AGENT#0 — casper-test ########");
  console.log(`signer: ${sk.publicKey.toHex()}`);
  console.log(`provider_id (agent#0): ${PROVIDER_ID}`);
  console.log(`client_id   (agent#1): ${CLIENT_ID}`);
  console.log(`job amount: ${JOB_AMOUNT} (AGT base units)`);

  // RESUME_JOB_IDS=4,7 — comma list of already-Funded job ids to settle first
  // (created by a prior crashed run). They consume already-locked funds.
  const resumeIds = (process.env.RESUME_JOB_IDS ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean).map((s) => BigInt(s));

  const repStart = await rep0();
  console.log(
    `\nagent#0 START: scoreBps=${repStart.scoreBps}, jobsCompleted=${repStart.jobsCompleted}`,
  );

  let done = 0;
  for (const id of resumeIds) {
    if (done >= RUNS) break;
    await settleOne(`RESUME JOB ${id} (${done + 1}/${RUNS})`, id);
    done++;
  }
  while (done < RUNS) {
    await settleOne(`NEW JOB (${done + 1}/${RUNS})`);
    done++;
  }

  // STEP 2 — verify on-chain
  const repEnd = await rep0();
  console.log("\n######## FINAL VERIFY ########");
  console.log(
    `agent#0 END: scoreBps=${repEnd.scoreBps}, jobsCompleted=${repEnd.jobsCompleted}`,
  );
  console.log(`(was scoreBps=${repStart.scoreBps}, jobsCompleted=${repStart.jobsCompleted})`);
  const moved =
    repEnd.jobsCompleted > repStart.jobsCompleted &&
    repEnd.scoreBps >= repStart.scoreBps;
  console.log(moved ? "✅ reputation increased" : "❌ reputation did NOT increase as expected");

  printSummary();

  // Machine-readable block for the fetch-snapshot edit (from:1, to:0).
  console.log("\n---- KNOWN_SETTLEMENTS ROWS ----");
  for (const j of records) {
    console.log(
      JSON.stringify({
        txHash: j.settleHash,
        from: CLIENT_ID,
        to: PROVIDER_ID,
        amount: j.amount,
        scoreBefore: j.scoreBefore,
        scoreAfter: j.scoreAfter,
      }),
    );
  }
}

main().catch((e) => {
  console.log("\n######## SCRIPT ERROR ########");
  console.log(String(e?.stack ?? e));
  if (!process.exitCode) process.exitCode = 1;
});
