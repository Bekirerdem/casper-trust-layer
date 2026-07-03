import { NextResponse } from "next/server";
import { PublicKey } from "casper-js-sdk";
import { createTrustClient, getAgent } from "casper-trust";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCAN_LIMIT = 24;

const hex64 = (s: string) => s.toLowerCase().match(/[0-9a-f]{64}/)?.[0] ?? null;

/**
 * Finds the agent ids owned by a wallet: GET /api/agents/mine?publicKey=<hex>
 * Scans the registry (ids are sequential; stops at the first gap).
 */
export async function GET(req: Request) {
  const publicKey = new URL(req.url).searchParams.get("publicKey");
  if (!publicKey) return NextResponse.json({ error: "publicKey required" }, { status: 400 });

  try {
    const walletHash = hex64(PublicKey.fromHex(publicKey).accountHash().toPrefixedString());
    const client = createTrustClient();

    const mine: number[] = [];
    for (let id = 0; id < SCAN_LIMIT; id++) {
      const agent = await getAgent(client, id);
      if (!agent) break; // ids are sequential — first gap = end of registry
      if (agent.status === "Active" && hex64(agent.wallet) === walletHash) mine.push(id);
    }

    return NextResponse.json({ agentIds: mine });
  } catch (e) {
    const message = e instanceof Error ? e.message : "scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
