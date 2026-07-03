"use client";

// Full wallet-signed hire flow (client = the visitor's registered agent,
// provider = a demo agent operated by the server):
//   1. approve      — CEP-18 allowance for the escrow          (wallet-signed)
//   2. create_job   — client funds the job, tokens lock        (wallet-signed)
//   3. submit_work  — the hired agent delivers                 (server-signed)
//   4. approve(job) — client releases, settlement fires,
//                     reputation accrues on-chain              (wallet-signed)
// Every step waits for on-chain finality via /api/tx/status before the next.

type SignResult = { cancelled?: boolean; signature?: Uint8Array; signatureHex?: string };
type Provider = {
  signTransaction?: (txJson: string, pubKeyHex: string) => Promise<SignResult>;
  sign?: (txJson: string, pubKeyHex: string) => Promise<SignResult>;
};

function getProvider(): Provider | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { CasperWalletProvider?: (o?: unknown) => Provider };
  try {
    return typeof w.CasperWalletProvider === "function" ? w.CasperWalletProvider() : null;
  } catch {
    return null;
  }
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(String(data.error ?? res.status));
  return data as T;
}

async function signWithWallet(txJson: unknown, publicKeyHex: string): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error("Casper Wallet bulunamadı");
  const signFn = provider.signTransaction ?? provider.sign;
  if (!signFn) throw new Error("cüzdan signTransaction desteklemiyor");
  const signed = await signFn.call(provider, JSON.stringify(txJson), publicKeyHex);
  if (signed?.cancelled) throw new Error("imza iptal edildi");
  const signatureHex =
    signed?.signatureHex ?? (signed?.signature ? bytesToHex(signed.signature) : null);
  if (!signatureHex) throw new Error("cüzdan imza döndürmedi");
  return signatureHex;
}

/** Polls /api/tx/status until the tx executes; throws if it executed with an error. */
async function waitForTx(txHash: string, timeoutMs = 180_000): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (Date.now() - start > timeoutMs) throw new Error(`tx ${txHash.slice(0, 10)}… zaman aşımı`);
    const res = await fetch(`/api/tx/status?hash=${txHash}`, { cache: "no-store" });
    if (res.ok) {
      const d = (await res.json()) as { executed: boolean; success?: boolean; error?: string };
      if (d.executed) {
        if (d.success) return;
        throw new Error(`tx başarısız: ${d.error ?? "bilinmeyen hata"}`);
      }
    }
    await new Promise((r) => setTimeout(r, 5_000));
  }
}

/** One wallet-signed step: server-build → wallet-sign → server-submit → finality. */
async function walletStep(
  publicKeyHex: string,
  buildBody: Record<string, unknown>,
): Promise<{ txHash: string; nextJobId?: string }> {
  const built = await postJson<{ txJson: unknown; nextJobId?: string }>(
    "/api/hire/build",
    { publicKeyHex, ...buildBody },
  );
  const signatureHex = await signWithWallet(built.txJson, publicKeyHex);
  const { txHash } = await postJson<{ txHash: string }>("/api/tx/submit", {
    txJson: built.txJson,
    signatureHex,
    publicKeyHex,
  });
  await waitForTx(txHash);
  return { txHash, nextJobId: built.nextJobId };
}

export async function claimFaucet(publicKeyHex: string): Promise<{ txHash: string }> {
  const { txHash } = await postJson<{ txHash: string }>("/api/faucet", { publicKeyHex });
  await waitForTx(txHash);
  return { txHash };
}

export type HirePhase = "approve" | "create_job" | "work" | "approve_job";

export interface HireResult {
  jobId: string;
  approveTx: string;
  createJobTx: string;
  workTx: string;
  approveJobTx: string;
}

export async function hireAgent(opts: {
  publicKeyHex: string;
  clientId: number;
  providerId: number;
  amountMotes: string;
  onPhase?: (phase: HirePhase, txHash?: string) => void;
}): Promise<HireResult> {
  const { publicKeyHex, clientId, providerId, amountMotes, onPhase } = opts;

  onPhase?.("approve");
  const approve = await walletStep(publicKeyHex, { step: "approve", amountMotes });
  onPhase?.("approve", approve.txHash);

  onPhase?.("create_job");
  const deadlineMs = Date.now() + 60 * 60 * 1000; // contract expects Unix ms
  const created = await walletStep(publicKeyHex, {
    step: "create_job",
    clientId,
    providerId,
    amountMotes,
    deadlineMs,
  });
  onPhase?.("create_job", created.txHash);
  const jobId = created.nextJobId;
  if (jobId === undefined) throw new Error("job id belirlenemedi");

  onPhase?.("work");
  const work = await postJson<{ txHash: string }>("/api/hire/work", { jobId });
  await waitForTx(work.txHash);
  onPhase?.("work", work.txHash);

  onPhase?.("approve_job");
  const released = await walletStep(publicKeyHex, { step: "approve_job", jobId });
  onPhase?.("approve_job", released.txHash);

  return {
    jobId,
    approveTx: approve.txHash,
    createJobTx: created.txHash,
    workTx: work.txHash,
    approveJobTx: released.txHash,
  };
}
