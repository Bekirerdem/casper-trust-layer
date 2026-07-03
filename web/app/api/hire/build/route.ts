import { NextResponse } from "next/server";
import { Args, CLValue, ContractCallBuilder, Key, PublicKey } from "casper-js-sdk";
import { createReadClient } from "@/lib/casper/read";
import { getNextJobId } from "@/lib/casper/escrowRead";

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
    const { publicKeyHex, step } = body;
    if (!publicKeyHex || !step) {
      return NextResponse.json({ error: "publicKeyHex, step required" }, { status: 400 });
    }

    const { cfg } = createReadClient();
    const from = PublicKey.fromHex(publicKeyHex);

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
        amount: CLValue.newCLUInt256(body.amountMotes),
      });
    } else if (step === "create_job") {
      if (body.clientId === undefined || body.providerId === undefined || !body.amountMotes || !body.deadlineMs) {
        return NextResponse.json({ error: "clientId, providerId, amountMotes, deadlineMs required" }, { status: 400 });
      }
      pkg = cfg.packages.escrow;
      entryPoint = "create_job";
      args = Args.fromMap({
        client_id: CLValue.newCLUInt32(body.clientId),
        provider: CLValue.newCLUInt32(body.providerId),
        amount: CLValue.newCLUInt256(body.amountMotes),
        deadline: CLValue.newCLUint64(body.deadlineMs), // contract expects Unix MILLISECONDS
      });
      nextJobId = (await getNextJobId()).toString();
    } else if (step === "approve_job") {
      if (body.jobId === undefined) return NextResponse.json({ error: "jobId required" }, { status: 400 });
      pkg = cfg.packages.escrow;
      entryPoint = "approve";
      args = Args.fromMap({ job_id: CLValue.newCLUint64(body.jobId) });
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
    const message = e instanceof Error ? e.message : "build failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
