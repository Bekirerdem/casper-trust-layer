import { NextResponse } from "next/server";
import { Transaction, PublicKey } from "casper-js-sdk";
import { createReadClient } from "@/lib/casper/read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Re-attaches the browser-wallet signature to the built Transaction and submits
// it via cspr.cloud (token stays server-side).
export async function POST(req: Request) {
  try {
    const { txJson, signatureHex, publicKeyHex } = (await req.json()) as {
      txJson: unknown;
      signatureHex: string;
      publicKeyHex: string;
    };
    if (!txJson || !signatureHex || !publicKeyHex) {
      return NextResponse.json({ error: "txJson, signatureHex, publicKeyHex gerekli" }, { status: 400 });
    }

    const tx = Transaction.fromJSON(txJson);
    const pub = PublicKey.fromHex(publicKeyHex);
    const sigBytes = Uint8Array.from(Buffer.from(signatureHex.replace(/^0x/, ""), "hex"));
    tx.setSignature(sigBytes, pub);

    const { rpc } = createReadClient();
    const res = await rpc.putTransaction(tx);
    const hash =
      (res as { transactionHash?: { toHex?: () => string } })?.transactionHash?.toHex?.() ??
      tx.hash.toHex();

    return NextResponse.json({ txHash: hash });
  } catch (e) {
    const message = e instanceof Error ? e.message : "submit failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
