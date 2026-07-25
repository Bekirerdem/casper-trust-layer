import { NextResponse } from "next/server";
import { getReputation, getAgent } from "casper-trust";
import { createReadClient } from "@/lib/casper/read";

// casper-js-sdk needs the Node runtime; read live on every request.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The full on-chain passport for one agent: identity + bond + earned record.
 *
 * The console's other reads only need score/jobs; this one surfaces the fields
 * the contracts already store but nothing rendered until now — bond, status,
 * agent URI, distinct clients and settled volume.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  const id = Number(agentId);

  if (!Number.isInteger(id) || id < 0 || id > 64) {
    return NextResponse.json({ error: "invalid agentId" }, { status: 400 });
  }

  try {
    const client = createReadClient();
    const [rep, agent] = await Promise.all([
      getReputation(client, id),
      getAgent(client, id),
    ]);

    if (!agent) {
      return NextResponse.json({ error: "agent not found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        agentId: id,
        // identity
        wallet: agent.wallet,
        agentUri: agent.agentUri,
        bond: agent.bond.toString(),
        status: agent.status,
        // earned record
        scoreBps: Number(rep.scoreBps),
        jobsCompleted: Number(rep.jobsCompleted),
        distinctClients: Number(rep.distinctClients),
        totalVolume: rep.totalVolume.toString(),
        grantedOutBps: Number(rep.grantedOutBps),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "rpc error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
