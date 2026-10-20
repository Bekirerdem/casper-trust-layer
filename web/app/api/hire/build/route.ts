import { NextResponse } from "next/server";
import { Args, CLValue, ContractCallBuilder, Key } from "casper-js-sdk";
import { createReadClient } from "@/lib/casper/read";
import { getNextJobId } from "@/lib/casper/escrowRead";
import { errorResponse, parseId, parsePublicKey } from "@/lib/casper/guard";

const U32_MAX = BigInt(4_294_967_295);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CALL_GAS = 5_000_000_000; // wasm lane 5 — exact gas for a small contract call

type BuildBody = {
  publicKeyHex: string;
  step: "approve" | "create_job" | "approve_job";
  amountMotes?: string;
  clientId?: number;
  providerId?: number;
  deadlineMs?: number;
  jobId?: string;
};

// Builds the UNSIGNED transaction for one step of the hire flow; the browser
// wallet signs it and /api/tx/submit sends it. Same pattern as /api/register/build.
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BuildBody;
    const { step } = body;
    const from = parsePublicKey(body.publicKeyHex);
    const { cfg } = createReadClient();

    let pkg: string;
    let entryPoint: string;
    let args: Args;
    let nextJobId: string | undefined;

    if (step === "approve") {
      if (!body.amountMotes) return NextResponse.json({ error: "amountMotes required" }, { status: 400 });
      pkg = cfg.packages.cep18;
      entryPoint = "approve";
      args = Args.fromMap({
        spender: CLValue.newCLKey(Key.newKey("hash-" + cfg.packages.escrow)),
        amount: CLValue.newCLUInt256(parseId(body.amountMotes, "amountMotes").toString()),
      });
    } else if (step === "create_job") {
      if (body.clientId === undefined || body.providerId === undefined || !body.amountMotes || !body.deadlineMs) {
        return NextResponse.json({ error: "clientId, providerId, amountMotes, deadlineMs required" }, { status: 400 });
      }
      pkg = cfg.packages.escrow;
      entryPoint = "create_job";
      args = Args.fromMap({
        client_id: CLValue.newCLUInt32(Number(parseId(body.clientId, "clientId", U32_MAX))),
        provider: CLValue.newCLUInt32(Number(parseId(body.providerId, "providerId", U32_MAX))),
        amount: CLValue.newCLUInt256(parseId(body.amountMotes, "amountMotes").toString()),
        // contract expects Unix MILLISECONDS
        deadline: CLValue.newCLUint64(parseId(body.deadlineMs, "deadlineMs").toString()),
      });
      nextJobId = (await getNextJobId()).toString();
    } else if (step === "approve_job") {
      if (body.jobId === undefined) return NextResponse.json({ error: "jobId required" }, { status: 400 });
      pkg = cfg.packages.escrow;
      entryPoint = "approve";
      args = Args.fromMap({ job_id: CLValue.newCLUint64(parseId(body.jobId, "jobId").toString()) });
    } else {
      return NextResponse.json({ error: `unknown step: ${step}` }, { status: 400 });
    }

    const tx = new ContractCallBuilder()
      .from(from)
      .byPackageHash(pkg)
      .entryPoint(entryPoint)
      .runtimeArgs(args)
      .chainName(cfg.chainName)
      .payment(CALL_GAS)
      .build();

    return NextResponse.json({ txJson: tx.toJSON(), hash: tx.hash.toHex(), nextJobId });
  } catch (e) {
    return errorResponse(e, "build failed");
  }
}
