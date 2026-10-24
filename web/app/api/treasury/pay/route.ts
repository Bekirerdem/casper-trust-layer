import { NextResponse } from "next/server";
import { Args, CLValue, ContractCallBuilder } from "casper-js-sdk";
import { createReadClient } from "@/lib/casper/read";
import { loadServerSigner } from "@/lib/casper/serverSigner";
import {
  clientIp,
  ensureOperatorReserve,
  errorResponse,
  parseAmount,
  parseId,
  throttle,
} from "@/lib/casper/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CALL_GAS = 5_000_000_000; // wasm lane 5

/**
 * Attempts a spend from the owner's envelope: POST { payee, amountAgt }.
 *
 * The treasury's delegated agent is the demo signer, so a visitor can trigger a
 * real on-chain decision without a wallet. The contract — not this route —
 * decides: an unproven payee, an over-cap amount or an exhausted daily budget
 * all revert, and the revert is itself the proof the envelope is enforced.
 *
 * Submits only; poll /api/tx/status for the verdict.
 */
export async function POST(req: Request) {
  try {
    // Every attempt burns real testnet gas whether it settles or reverts — and
    // reverting is the point of two of the three demo buttons — so attempts are
    // throttled and stop entirely once the operator is down to its reserve.
    throttle("treasury-pay", clientIp(req), 4, 60_000);

    const body = (await req.json()) as { payee?: unknown; amountAgt?: unknown };
    const payee = Number(parseId(body.payee, "payee", BigInt(64)));
    const motes = parseAmount(body.amountAgt, 9, 10_000); // AGT has 9 decimals

    const { rpc, cfg } = createReadClient();
    const signer = loadServerSigner();
    await ensureOperatorReserve(rpc, signer);

    // Spend is accounted per task id; a fresh id keeps each attempt independent
    // so the per-task cap reflects this single payment.
    const taskId = BigInt(Date.now());

    const tx = new ContractCallBuilder()
      .from(signer.publicKey)
      .byPackageHash(cfg.packages.treasury)
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

    return NextResponse.json({
      txHash: tx.hash.toHex(),
      payee,
      amountAgt: body.amountAgt,
      taskId: taskId.toString(),
    });
  } catch (e) {
    return errorResponse(e, "payment attempt failed");
  }
}
