import { NextResponse } from "next/server";
import { PublicKey } from "casper-js-sdk";
import { getAgent } from "casper-trust";
import { createReadClient } from "@/lib/casper/read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCAN_LIMIT = 24;
const CACHE_MS = 20_000; // page-refresh spam protection; short enough for post-register rescans

const hex64 = (s: string) => s.toLowerCase().match(/[0-9a-f]{64}/)?.[0] ?? null;
const cache = new Map<string, { at: number; agentIds: number[] }>();

/**
 * Finds the agent ids owned by a wallet: GET /api/agents/mine?publicKey=<hex>
 * Scans the registry (ids are sequential; stops at the first gap).
 */
export async function GET(req: Request) {
  const publicKey = new URL(req.url).searchParams.get("publicKey");
  if (!publicKey) return NextResponse.json({ error: "publicKey required" }, { status: 400 });

  try {
    const hit = cache.get(publicKey);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      return NextResponse.json({ agentIds: hit.agentIds, cached: true });
    }

    const walletHash = hex64(PublicKey.fromHex(publicKey).accountHash().toPrefixedString());
    const client = createReadClient();

    const mine: number[] = [];
    for (let id = 0; id < SCAN_LIMIT; id++) {
      const agent = await getAgent(client, id);
      if (!agent) break; // ids are sequential — first gap = end of registry
      if (agent.status === "Active" && hex64(agent.wallet) === walletHash) mine.push(id);
    }

    cache.set(publicKey, { at: Date.now(), agentIds: mine });
    return NextResponse.json({ agentIds: mine });
  } catch (e) {
    const message = e instanceof Error ? e.message : "scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
