/**
 * End-to-end test of the web hire-flow API against live casper-test,
 * playing the "browser wallet" with the operator key (which owns the demo
 * agents, so client-side signatures are valid).
 *
 * Flow: faucet → approve → create_job → work → approve_job → live trust read.
 *
 *   BASE_URL=http://localhost:3199 CASPER_SECRET_KEY_PEM=<path> \
 *     npx vite-node scripts/test-hire-api.mts
 */
import { readFileSync } from "node:fs";
import { KeyAlgorithm, PrivateKey, Transaction } from "casper-js-sdk";

const BASE = process.env.BASE_URL ?? "http://localhost:3199";
const CLIENT_ID = Number(process.env.HIRE_CLIENT_ID ?? 1);
const PROVIDER_ID = Number(process.env.HIRE_PROVIDER_ID ?? 2);
const AMOUNT = "1000000"; // 0.001 AGT

const sk = PrivateKey.fromPem(
  readFileSync(process.env.CASPER_SECRET_KEY_PEM!, "utf8"),
  KeyAlgorithm.SECP256K1,
);
const publicKeyHex = sk.publicKey.toHex();
console.log("operator pubkey:", publicKeyHex);

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

// --- run ---------------------------------------------------------------

console.log(`\n[0] agents/mine (expect demo agent ids)`);
const mine = await fetch(`${BASE}/api/agents/mine?publicKey=${publicKeyHex}`).then((r) => r.json());
console.log("  agentIds:", JSON.stringify(mine));

console.log(`\n[1] faucet → a FRESH account (real visitor scenario; CEP-18 rejects self-transfer)`);
const fresh = await PrivateKey.generate(KeyAlgorithm.SECP256K1);
const faucet = await post<{ txHash: string }>("/api/faucet", {
  publicKeyHex: fresh.publicKey.toHex(),
});
await waitForTx(faucet.txHash, "faucet");

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

console.log(`\n[4] work (server-signed submit_work)`);
const work = await post<{ txHash: string; resultHash: string }>("/api/hire/work", {
  jobId: created.nextJobId,
});
console.log("  resultHash:", work.resultHash);
await waitForTx(work.txHash, "work");

console.log(`\n[5] approve_job (settlement + reputation)`);
await walletStep("approve_job", { jobId: created.nextJobId });

console.log(`\n[6] live trust read for provider #${PROVIDER_ID}`);
const trust = await fetch(`${BASE}/api/trust/${PROVIDER_ID}`).then((r) => r.json());
console.log("  ", JSON.stringify(trust));

console.log("\nALL STEPS PASSED — hire flow is live end-to-end.");
