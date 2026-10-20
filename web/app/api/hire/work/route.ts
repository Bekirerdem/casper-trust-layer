import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { Args, CLValue, ContractCallBuilder } from "casper-js-sdk";
import { getAgent } from "casper-trust";
import { createReadClient } from "@/lib/casper/read";
import { loadServerSigner } from "@/lib/casper/serverSigner";
import { getJob } from "@/lib/casper/escrowRead";
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

// Jobs this instance already delivered — a retry must not burn gas twice.
const delivered = new Set<string>();

// The provider side of the hire flow: the demo agents (#0-#3) are operated by
// the server key, so "the agent delivers" = a server-signed submit_work.
// The server only signs after reading the job from chain: it must exist, still
// be Funded, be inside its deadline, and have hired an agent whose wallet IS the
// server key. Anything else would revert and burn gas for nothing.
export async function POST(req: Request) {
  try {
    throttle("hire-work", clientIp(req), 6, 60_000);

    const body = (await req.json()) as { jobId?: unknown };
    const jobId = parseId(body.jobId, "jobId");
    if (delivered.has(jobId.toString())) {
      throw new GuardError(409, "work already submitted for this job");
    }

    const client = createReadClient();
    const { rpc, cfg } = client;
    const signer = loadServerSigner();

    const job = await getJob(jobId);
    if (!job) throw new GuardError(404, "job not found");
    if (job.state !== "Funded") throw new GuardError(409, `job is ${job.state}, not Funded`);
    if (BigInt(Date.now()) >= job.deadlineMs) throw new GuardError(409, "job deadline has passed");

    const provider = await getAgent(client, job.provider);
    const signerHash = hex64(signer.publicKey.accountHash().toPrefixedString());
    if (!provider || hex64(provider.wallet) !== signerHash) {
      throw new GuardError(403, "this job did not hire a demo agent");
    }

    await ensureOperatorReserve(rpc, signer);

    // Deliverable fingerprint — what a real agent would pin after doing the work.
    const resultHash =
      "sha256:" + createHash("sha256").update(randomBytes(32)).digest("hex").slice(0, 40);

    const tx = new ContractCallBuilder()
      .from(signer.publicKey)
      .byPackageHash(cfg.packages.escrow)
      .entryPoint("submit_work")
      .runtimeArgs(
        Args.fromMap({
          job_id: CLValue.newCLUint64(jobId.toString()),
          result_hash: CLValue.newCLString(resultHash),
        }),
      )
      .chainName(cfg.chainName)
      .payment(CALL_GAS)
      .build();
    tx.sign(signer);

    await rpc.putTransaction(tx);
    delivered.add(jobId.toString());

    return NextResponse.json({ txHash: tx.hash.toHex(), resultHash });
  } catch (e) {
    return errorResponse(e, "work failed");
  }
}
