import { NextResponse } from "next/server";
import { PublicKey } from "casper-js-sdk";
import { getVault, vaultCount, vaultOf } from "@/lib/casper/vaultRead";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The signed-in customer's own vault: GET /api/vault?publicKey=<hex>
 * Without a publicKey, reports how many vaults exist — used before connecting.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const publicKey = url.searchParams.get("publicKey");
  const id = url.searchParams.get("id");

  try {
    if (id !== null) {
      const vault = await getVault(Number(id));
      return NextResponse.json(vault ?? { error: "not found" }, {
        status: vault ? 200 : 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (!publicKey) {
      return NextResponse.json({ total: await vaultCount() }, { headers: { "Cache-Control": "no-store" } });
    }

    const accountHash = PublicKey.fromHex(publicKey).accountHash().toPrefixedString();
    const vault = await vaultOf(accountHash);
    return NextResponse.json(
      { vault, total: await vaultCount() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "rpc error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
