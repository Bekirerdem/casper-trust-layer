import { NextResponse } from "next/server";
import { getEnvelope, TREASURY_PACKAGE } from "@/lib/casper/treasuryRead";
import { errorResponse } from "@/lib/casper/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The owner's spending envelope, live from AgentTreasury storage. */
export async function GET() {
  try {
    const envelope = await getEnvelope();
    return NextResponse.json(
      { ...envelope, package: TREASURY_PACKAGE },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e, "rpc error", 502);
  }
}
