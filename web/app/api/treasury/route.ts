import { NextResponse } from "next/server";
import { getEnvelope, TREASURY_PACKAGE } from "@/lib/casper/treasuryRead";

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
    const message = e instanceof Error ? e.message : "rpc error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
