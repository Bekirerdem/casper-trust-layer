import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { Args, CLValue, ContractCallBuilder } from "casper-js-sdk";
import { createReadClient } from "@/lib/casper/read";
import { loadServerSigner } from "@/lib/casper/serverSigner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CALL_GAS = 5_000_000_000; // wasm lane 5 — exact gas for a small contract call

// The provider side of the hire flow: the demo agents (#0-#3) are operated by
// the server key, so "the agent delivers" = a server-signed submit_work.
// The contract enforces that the caller IS the job's provider wallet, so this
// endpoint can only ever act on jobs that hired one of our demo agents.
export async function POST(req: Request) {
  try {
    const { jobId } = (await req.json()) as { jobId: string };
    if (jobId === undefined || jobId === null || jobId === "") {
      return NextResponse.json({ error: "jobId gerekli" }, { status: 400 });
    }

    const { rpc, cfg } = createReadClient();
    const signer = loadServerSigner();

    // Deliverable fingerprint — what a real agent would pin after doing the work.
    const resultHash =
      "sha256:" + createHash("sha256").update(randomBytes(32)).digest("hex").slice(0, 40);

    const tx = new ContractCallBuilder()
      .from(signer.publicKey)
      .byPackageHash(cfg.packages.escrow)
      .entryPoint("submit_work")
      .runtimeArgs(
        Args.fromMap({
          job_id: CLValue.newCLUint64(String(jobId)),
          result_hash: CLValue.newCLString(resultHash),
        }),
      )
      .chainName(cfg.chainName)
      .payment(CALL_GAS)
      .build();
    tx.sign(signer);

    await rpc.putTransaction(tx);

    return NextResponse.json({ txHash: tx.hash.toHex(), resultHash });
  } catch (e) {
    const message = e instanceof Error ? e.message : "work failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
