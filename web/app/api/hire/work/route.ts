import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { Args, CLValue, ContractCallBuilder } from "casper-js-sdk";
import { getAgent, getJob } from "casper-trust";
import { createReadClient } from "@/lib/casper/read";
import { loadServerSigner } from "@/lib/casper/serverSigner";
import {
  GuardError,
  clientIp,
  ensureOperatorReserve,
  errorResponse,
  parseId,
  throttle,
} from "@/lib/casper/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CALL_GAS = 5_000_000_000; // wasm lane 5 — exact gas for a small contract call

const hex64 = (s: string) => s.toLowerCase().match(/[0-9a-f]{64}/)?.[0] ?? null;

// Steps this instance already signed — a retry must not burn gas twice.
const signed = new Set<string>();

// The provider side of the hire flow. The demo agents (#0-#2) use the demo
// signer as their wallet, so "the agent takes the job" and "the agent delivers"
// are server-signed calls. The route is driven by the job's on-chain state —
// Funded → accept_job, Accepted → submit_work — so the browser calls it once per
// step and waits for finality in between.
//
// The server only signs after reading the job from chain: it must exist, be in
// one of those two states, be inside its deadline, and have hired an agent whose
// wallet IS the demo signer. Anything else would revert and burn gas for nothing.
export async function POST(req: Request) {
  try {
    throttle("hire-work", clientIp(req), 6, 60_000);

    const body = (await req.json()) as { jobId?: unknown };
    const jobId = parseId(body.jobId, "jobId");

    const client = createReadClient();
    const { rpc, cfg } = client;
    const signer = loadServerSigner();

    const job = await getJob(client, jobId);
    if (!job) throw new GuardError(404, "job not found");
    if (job.state !== "Funded" && job.state !== "Accepted") {
      throw new GuardError(409, `job is ${job.state} — nothing for the agent to do`);
    }
    if (BigInt(Date.now()) >= job.deadline) throw new GuardError(409, "job deadline has passed");

    const stepKey = `${jobId}:${job.state}`;
    if (signed.has(stepKey)) throw new GuardError(409, "already signed — waiting for the chain");

    const provider = await getAgent(client, job.provider);
    const signerHash = hex64(signer.publicKey.accountHash().toPrefixedString());
    if (!provider || provider.status !== "Active" || hex64(provider.wallet) !== signerHash) {
      throw new GuardError(403, "this job did not hire a demo agent");
    }

    await ensureOperatorReserve(rpc, signer);

    let step: "accept" | "work";
    let args: Args;
    let resultHash: string | undefined;
    if (job.state === "Funded") {
      step = "accept";
      args = Args.fromMap({ job_id: CLValue.newCLUint64(jobId.toString()) });
    } else {
      step = "work";
      // Deliverable fingerprint — what a real agent would pin after doing the work.
      resultHash = "sha256:" + createHash("sha256").update(randomBytes(32)).digest("hex").slice(0, 40);
      args = Args.fromMap({
        job_id: CLValue.newCLUint64(jobId.toString()),
        result_hash: CLValue.newCLString(resultHash),
      });
    }

    const tx = new ContractCallBuilder()
      .from(signer.publicKey)
      .byPackageHash(cfg.packages.escrow)
      .entryPoint(step === "accept" ? "accept_job" : "submit_work")
      .runtimeArgs(args)
      .chainName(cfg.chainName)
      .payment(CALL_GAS)
      .build();
    tx.sign(signer);

    await rpc.putTransaction(tx);
    signed.add(stepKey);

    return NextResponse.json({ step, txHash: tx.hash.toHex(), resultHash });
  } catch (e) {
    return errorResponse(e, "work failed");
  }
}
