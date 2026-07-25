import { NextResponse } from "next/server";
import { Args, CLValue, ContractCallBuilder } from "casper-js-sdk";
import { createReadClient } from "@/lib/casper/read";
import { loadServerSigner } from "@/lib/casper/serverSigner";
import { TREASURY_PACKAGE } from "@/lib/casper/treasuryRead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CALL_GAS = 5_000_000_000; // wasm lane 5

// Every attempt burns real testnet CSPR whether it settles or reverts, so the
// endpoint is throttled. Serverless instances don't share this map, which is
// fine — it is a spend brake, not a security control.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 4;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

/**
 * Attempts a spend from the owner's envelope: POST { payee, amountAgt }.
 *
 * The treasury's delegated agent is the server key, so a visitor can trigger a
 * real on-chain decision without a wallet. The contract — not this route —
 * decides: an unproven payee, an over-cap amount or an exhausted daily budget
 * all revert, and the revert is itself the proof the envelope is enforced.
 *
 * Submits only; poll /api/tx/status for the verdict.
 */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (rateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many attempts — each one spends real testnet gas. Try again shortly." },
        { status: 429 },
      );
    }

    const { payee, amountAgt } = (await req.json()) as { payee: number; amountAgt: string };
    if (!Number.isInteger(payee) || payee < 0 || payee > 64) {
      return NextResponse.json({ error: "invalid payee" }, { status: 400 });
    }
    const amount = Number(amountAgt);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "invalid amount" }, { status: 400 });
    }
    const motes = BigInt(Math.round(amount * 1e9)); // AGT has 9 decimals

    const { rpc, cfg } = createReadClient();
    const signer = loadServerSigner();

    // Spend is accounted per task id; a fresh id keeps each attempt independent
    // so the per-task cap reflects this single payment.
    const taskId = BigInt(Date.now());

    const tx = new ContractCallBuilder()
      .from(signer.publicKey)
      .byPackageHash(TREASURY_PACKAGE)
      .entryPoint("pay")
      .runtimeArgs(
        Args.fromMap({
          task_id: CLValue.newCLUint64(taskId.toString()),
          payee: CLValue.newCLUInt32(payee),
          amount: CLValue.newCLUInt256(motes.toString()),
        }),
      )
      .chainName(cfg.chainName)
      .payment(CALL_GAS)
      .build();
    tx.sign(signer);

    await rpc.putTransaction(tx);

    return NextResponse.json({ txHash: tx.hash.toHex(), payee, amountAgt, taskId: taskId.toString() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "payment attempt failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
