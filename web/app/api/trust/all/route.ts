import { NextResponse } from "next/server";
import { createReadClient, getReputation } from "@/lib/casper/read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_MS = 45_000; // cspr.cloud rate-limits bursts — serve repeats from memory
const SCAN_LIMIT = 24;

type Rep = { agentId: number; scoreBps: number; jobsCompleted: number; exists: boolean };
let cache: { at: number; agents: Rep[] } | null = null;

/**
 * Live reputation for the whole registry in ONE function invocation
 * (sequential reads + a short cache), instead of N parallel client calls —
 * the previous per-agent fan-out tripped the RPC provider's rate limit.
 */
export async function GET() {
  try {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      return NextResponse.json({ agents: cache.agents, cached: true });
    }

    const client = createReadClient();
    const agents: Rep[] = [];
    for (let id = 0; id < SCAN_LIMIT; id++) {
      const rep = await getReputation(client, id);
      if (!rep.exists) break; // ids are sequential — first gap = end of registry
      agents.push(rep);
    }

    cache = { at: Date.now(), agents };
    return NextResponse.json({ agents, cached: false });
  } catch (e) {
    // On rate-limit or RPC failure, serve the last good data if we have it.
    if (cache) return NextResponse.json({ agents: cache.agents, cached: true });
    const message = e instanceof Error ? e.message : "read failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
