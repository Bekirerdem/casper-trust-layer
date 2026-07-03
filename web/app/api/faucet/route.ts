import { NextResponse } from "next/server";
import { Args, CLValue, ContractCallBuilder, Key, PublicKey } from "casper-js-sdk";
import { createReadClient } from "@/lib/casper/read";
import { loadServerSigner } from "@/lib/casper/serverSigner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CALL_GAS = 5_000_000_000; // wasm lane 5 — exact gas for a small contract call
const FAUCET_AMOUNT = BigInt(10_000_000); // 0.01 AGT (9 decimals) ≈ 10 demo jobs
const CLAIM_COOLDOWN_MS = 60 * 60 * 1000;

// Per-instance cooldown — enough to stop casual drain on a testnet faucet.
const lastClaim = new Map<string, number>();

// Sends test AGT from the operator supply to the caller's account so they can
// fund a hire. Gas + tokens are testnet-only.
export async function POST(req: Request) {
  try {
    const { publicKeyHex } = (await req.json()) as { publicKeyHex: string };
    if (!publicKeyHex) {
      return NextResponse.json({ error: "publicKeyHex required" }, { status: 400 });
    }

    const prev = lastClaim.get(publicKeyHex.toLowerCase());
    if (prev && Date.now() - prev < CLAIM_COOLDOWN_MS) {
      return NextResponse.json(
        { error: "faucet cooldown — one claim per wallet per hour" },
        { status: 429 },
      );
    }

    const { rpc, cfg } = createReadClient();
    const signer = loadServerSigner();
    const recipient = PublicKey.fromHex(publicKeyHex);

    // The operator wallet holds the AGT supply — a transfer to itself would
    // revert (CEP-18 rejects self-transfer). It is already funded; skip.
    if (recipient.accountHash().toPrefixedString() === signer.publicKey.accountHash().toPrefixedString()) {
      return NextResponse.json({ skipped: true });
    }

    const recipientKey = Key.newKey(recipient.accountHash().toPrefixedString());

    const tx = new ContractCallBuilder()
      .from(signer.publicKey)
      .byPackageHash(cfg.packages.cep18)
      .entryPoint("transfer")
      .runtimeArgs(
        Args.fromMap({
          recipient: CLValue.newCLKey(recipientKey),
          amount: CLValue.newCLUInt256(FAUCET_AMOUNT.toString()),
        }),
      )
      .chainName(cfg.chainName)
      .payment(CALL_GAS)
      .build();
    tx.sign(signer);

    await rpc.putTransaction(tx);
    lastClaim.set(publicKeyHex.toLowerCase(), Date.now());

    return NextResponse.json({ txHash: tx.hash.toHex(), amountMotes: FAUCET_AMOUNT.toString() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "faucet failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
