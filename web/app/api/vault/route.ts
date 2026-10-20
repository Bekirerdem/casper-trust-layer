import { NextResponse } from "next/server";
import { getVault, vaultCount, vaultOf } from "@/lib/casper/vaultRead";
import { errorResponse, parseId, parsePublicKey } from "@/lib/casper/guard";

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
      const vault = await getVault(Number(parseId(id, "id", BigInt(4_294_967_295))));
      return NextResponse.json(vault ?? { error: "not found" }, {
        status: vault ? 200 : 404,
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (!publicKey) {
      return NextResponse.json({ total: await vaultCount() }, { headers: { "Cache-Control": "no-store" } });
    }

    const accountHash = parsePublicKey(publicKey).accountHash().toPrefixedString();
    const vault = await vaultOf(accountHash);
    return NextResponse.json(
      { vault, total: await vaultCount() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e, "rpc error", 502);
  }
}
