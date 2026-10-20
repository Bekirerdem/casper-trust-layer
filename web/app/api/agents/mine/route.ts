import { NextResponse } from "next/server";
import { getAgent } from "casper-trust";
import { createReadClient } from "@/lib/casper/read";
import { clientIp, errorResponse, parsePublicKey, throttle } from "@/lib/casper/guard";

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
  try {
    throttle("agents-mine", clientIp(req), 20, 60_000);
    const pub = parsePublicKey(new URL(req.url).searchParams.get("publicKey"));
    const publicKey = pub.toHex();

    const hit = cache.get(publicKey);
    if (hit && Date.now() - hit.at < CACHE_MS) {
      return NextResponse.json({ agentIds: hit.agentIds, cached: true });
    }

    const walletHash = hex64(pub.accountHash().toPrefixedString());
    const client = createReadClient();

    const mine: number[] = [];
    for (let id = 0; id < SCAN_LIMIT; id++) {
      const agent = await getAgent(client, id);
      if (!agent) break; // ids are sequential — first gap = end of registry
      if (agent.status === "Active" && hex64(agent.wallet) === walletHash) mine.push(id);
    }

    if (cache.size >= 1_000) cache.delete(cache.keys().next().value as string);
    cache.set(publicKey, { at: Date.now(), agentIds: mine });
    return NextResponse.json({ agentIds: mine });
  } catch (e) {
    return errorResponse(e, "scan failed");
  }
}
