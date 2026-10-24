/**
 * End-to-end test of the web hire-flow API against live casper-test, playing
 * the "browser wallet" with a client agent's key (client B, #4, from
 * seed-v2.mts — a different owner than the demo providers, so the settlement
 * really earns).
 *
 * Flow: faucet → approve → create_job → accept → work → approve_job → trust read.
 *
 *   BASE_URL=http://localhost:3199 npx vite-node scripts/test-hire-api.mts
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { KeyAlgorithm, PrivateKey, Transaction } from "casper-js-sdk";

const BASE = process.env.BASE_URL ?? "http://localhost:3199";
const CLIENT_ID = Number(process.env.HIRE_CLIENT_ID ?? 4);
const PROVIDER_ID = Number(process.env.HIRE_PROVIDER_ID ?? 1);
const AMOUNT = "1000000"; // 0.001 AGT

function loadKey(path: string): PrivateKey {
  const pem = readFileSync(path, "utf8");
  for (const algo of [KeyAlgorithm.SECP256K1, KeyAlgorithm.ED25519]) {
    try {
      return PrivateKey.fromPem(pem, algo);
    } catch {
      /* try the other curve */
    }
  }
  throw new Error(`cannot parse ${path}`);
}

const sk = loadKey(process.env.CLIENT_PEM ?? join(homedir(), ".casper-hero", "faucet2_secret.pem"));
const publicKeyHex = sk.publicKey.toHex();
console.log("client pubkey:", publicKeyHex);

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(`${url}: ${data.error ?? res.status}`);
  return data;
}

async function waitForTx(hash: string, label: string): Promise<void> {
  process.stdout.write(`  waiting ${label} ${hash.slice(0, 12)}… `);
  const start = Date.now();
  for (;;) {
    if (Date.now() - start > 240_000) throw new Error(`${label}: timeout`);
    const res = await fetch(`${BASE}/api/tx/status?hash=${hash}`);
    const d = (await res.json()) as { executed?: boolean; success?: boolean; error?: string };
    if (d.executed) {
      if (!d.success) throw new Error(`${label} FAILED on-chain: ${d.error}`);
      console.log("✓ executed");
      return;
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

/** Plays the browser wallet: signs the built tx and extracts the raw signature hex. */
function walletSign(txJson: unknown): string {
  const tx = Transaction.fromJSON(txJson);
  tx.sign(sk);
  const approval = tx.approvals[0];
  const hex = approval.signature.toHex?.() ?? String(approval.signature);
  return hex;
}

async function walletStep(step: string, extra: Record<string, unknown>) {
  const built = await post<{ txJson: unknown; nextJobId?: string }>("/api/hire/build", {
    publicKeyHex,
    step,
    ...extra,
  });
  const signatureHex = walletSign(built.txJson);
  const { txHash } = await post<{ txHash: string }>("/api/tx/submit", {
    txJson: built.txJson,
    signatureHex,
    publicKeyHex,
  });
  await waitForTx(txHash, step);
  return { txHash, nextJobId: built.nextJobId };
}

async function agentStep(jobId: string, expect: "accept" | "work") {
  const r = await post<{ step: string; txHash: string; resultHash?: string }>("/api/hire/work", { jobId });
  if (r.step !== expect) throw new Error(`/api/hire/work did ${r.step}, expected ${expect}`);
  if (r.resultHash) console.log("  resultHash:", r.resultHash);
  await waitForTx(r.txHash, expect);
}

// --- run ---------------------------------------------------------------

console.log(`\n[0] agents/mine (expect #${CLIENT_ID})`);
const mine = await fetch(`${BASE}/api/agents/mine?publicKey=${publicKeyHex}`).then((r) => r.json());
console.log("  agentIds:", JSON.stringify(mine));

console.log(`\n[1] faucet → a FRESH account must be refused (no account on chain yet)`);
const fresh = PrivateKey.generate(KeyAlgorithm.ED25519);
const refused = await fetch(BASE + "/api/faucet", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ publicKeyHex: fresh.publicKey.toHex() }),
});
if (refused.status !== 400) throw new Error(`faucet answered ${refused.status} for an account that does not exist`);
console.log("  ✓ 400");

const before = await fetch(`${BASE}/api/trust/${PROVIDER_ID}`).then((r) => r.json());
console.log(`\n    provider #${PROVIDER_ID} before:`, JSON.stringify(before));

console.log(`\n[2] approve (allowance for escrow)`);
await walletStep("approve", { amountMotes: AMOUNT });

console.log(`\n[3] create_job  client #${CLIENT_ID} hires provider #${PROVIDER_ID}`);
const created = await walletStep("create_job", {
  clientId: CLIENT_ID,
  providerId: PROVIDER_ID,
  amountMotes: AMOUNT,
  deadlineMs: Date.now() + 60 * 60 * 1000,
});
console.log("  jobId:", created.nextJobId);

console.log(`\n[4] accept (server-signed accept_job)`);
await agentStep(created.nextJobId!, "accept");

console.log(`\n[5] work (server-signed submit_work)`);
await agentStep(created.nextJobId!, "work");

console.log(`\n[6] approve_job (settlement + reputation)`);
await walletStep("approve_job", { jobId: created.nextJobId });

console.log(`\n[7] live trust read for provider #${PROVIDER_ID}`);
const after = await fetch(`${BASE}/api/trust/${PROVIDER_ID}`).then((r) => r.json());
console.log("  ", JSON.stringify(after));
if (after.jobsCompleted !== before.jobsCompleted + 1) throw new Error("jobsCompleted did not move");

console.log("\nALL STEPS PASSED — hire flow is live end-to-end.");
