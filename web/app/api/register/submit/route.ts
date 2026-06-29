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

    // Casper approvals need the algorithm-tagged signature (01=ed25519, 02=secp256k1).
    // The wallet returns the raw 64-byte signature → prepend the tag from the public key.
    let sigBytes = Uint8Array.from(Buffer.from(signatureHex.replace(/^0x/, ""), "hex"));
    if (sigBytes.length === 64) {
      const algoTag = parseInt(publicKeyHex.slice(0, 2), 16); // 01 or 02
      sigBytes = Uint8Array.from([algoTag, ...sigBytes]);
    }
    tx.setSignature(sigBytes, pub);

    const { rpc } = createReadClient();
    const res = await rpc.putTransaction(tx);
    const hash =
      (res as { transactionHash?: { toHex?: () => string } })?.transactionHash?.toHex?.() ??
      tx.hash.toHex();

    return NextResponse.json({ txHash: hash });
  } catch (e) {
    const err = e as { message?: string; code?: number; data?: unknown };
    const detail = err?.data ? ` · ${JSON.stringify(err.data)}` : "";
    const message = `${err?.message ?? "submit failed"}${err?.code ? ` (code ${err.code})` : ""}${detail}`;
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
