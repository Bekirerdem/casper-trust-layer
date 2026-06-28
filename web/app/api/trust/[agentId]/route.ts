import { NextResponse } from "next/server";
import { createReadClient, getReputation } from "@/lib/casper/read";

// casper-js-sdk needs the Node runtime; read live on every request.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const snapshot = await getReputation(client, id);
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "rpc error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
