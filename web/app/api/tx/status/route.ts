import { NextResponse } from "next/server";
import { createReadClient } from "@/lib/casper/read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Polls a transaction's execution status: GET /api/tx/status?hash=<txHash>
 * → { executed: false } while pending
 * → { executed: true, success: boolean, error?: string } once finalized
 */
export async function GET(req: Request) {
  const hash = new URL(req.url).searchParams.get("hash");
  if (!hash) return NextResponse.json({ error: "hash required" }, { status: 400 });

  try {
    const { rpc } = createReadClient();
    const res = await rpc.getTransactionByTransactionHash(hash);
    const exec =
      (res as {
        executionInfo?: { executionResult?: { errorMessage?: string; v1?: { errorMessage?: string } } };
      })?.executionInfo?.executionResult;
    if (!exec) return NextResponse.json({ executed: false });
    const error = exec.errorMessage ?? exec.v1?.errorMessage;
    return NextResponse.json({ executed: true, success: !error, error });
  } catch (e) {
    // Node may not know the tx yet right after submission — report as pending.
    const err = e as { message?: string; code?: number; statusCode?: number };
    const code = err?.code ?? err?.statusCode;
    if (code === -32000 || code === -32001 || /not found/i.test(err?.message ?? "")) {
      return NextResponse.json({ executed: false });
    }
    return NextResponse.json({ error: err?.message ?? "status failed" }, { status: 502 });
  }
}
