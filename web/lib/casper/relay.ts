import { NextResponse } from "next/server";
import { Transaction } from "casper-js-sdk";
import { CONTRACTS } from "@/lib/casper/contracts";
import { createReadClient } from "@/lib/casper/read";
import { GuardError, clientIp, errorResponse, parsePublicKey, throttle } from "@/lib/casper/guard";

// proxy_caller wasm (register) is the largest body we ever relay; its hex in the
// JSON roughly doubles it. Anything bigger is not one of our transactions.
const MAX_BODY_BYTES = 600_000;

/**
 * Wallet-signed transaction relay: re-attaches the browser-wallet signature to a
 * server-built Transaction and submits it. The caller pays the gas, but the
 * relay still only forwards transactions for this chain that touch one of our
 * contracts — it is not an open broadcaster.
 */
export async function relaySignedTransaction(req: Request) {
  try {
    throttle("relay", clientIp(req), 20, 60_000);

    const length = Number(req.headers.get("content-length") ?? 0);
    if (length > MAX_BODY_BYTES) throw new GuardError(413, "transaction too large");

    const { txJson, signatureHex, publicKeyHex } = (await req.json()) as {
      txJson?: unknown;
      signatureHex?: unknown;
      publicKeyHex?: unknown;
    };
    if (!txJson || typeof signatureHex !== "string" || !/^(0x)?[0-9a-fA-F]{128,130}$/.test(signatureHex)) {
      throw new GuardError(400, "txJson, signatureHex, publicKeyHex required");
    }
    const pub = parsePublicKey(publicKeyHex);

    const { rpc, cfg } = createReadClient();
    const tx = Transaction.fromJSON(txJson);
    if (tx.chainName !== cfg.chainName) throw new GuardError(400, "wrong chain");

    const body = JSON.stringify(txJson).toLowerCase();
    if (!CONTRACTS.some((c) => body.includes(c.pkg))) {
      throw new GuardError(400, "transaction does not target a Casper Trust Layer contract");
    }

    // Casper approvals need the algorithm-tagged signature (01=ed25519, 02=secp256k1).
    // The wallet returns the raw 64-byte signature → prepend the tag from the public key.
    let sigBytes = Uint8Array.from(Buffer.from(signatureHex.replace(/^0x/, ""), "hex"));
    if (sigBytes.length === 64) {
      const algoTag = parseInt(pub.toHex().slice(0, 2), 16); // 01 or 02
      sigBytes = Uint8Array.from([algoTag, ...sigBytes]);
    }
    tx.setSignature(sigBytes, pub);

    const res = await rpc.putTransaction(tx);
    const hash =
      (res as { transactionHash?: { toHex?: () => string } })?.transactionHash?.toHex?.() ??
      tx.hash.toHex();

    return NextResponse.json({ txHash: hash });
  } catch (e) {
    return errorResponse(e, "submit failed — the node rejected the transaction", 502);
  }
}
