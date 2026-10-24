import { NextResponse } from "next/server";
import { Args, CLValue, ContractCallBuilder, Key, PurseIdentifier } from "casper-js-sdk";
import { createReadClient } from "@/lib/casper/read";
import { loadServerSigner } from "@/lib/casper/serverSigner";
import {
  GuardError,
  clientIp,
  ensureOperatorReserve,
  errorResponse,
  parsePublicKey,
  throttle,
} from "@/lib/casper/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CALL_GAS = 5_000_000_000; // wasm lane 5 — exact gas for a small contract call
const FAUCET_AMOUNT = BigInt(10_000_000); // 0.01 AGT (9 decimals) ≈ 10 demo jobs
const HOUR = 60 * 60 * 1000;

// Sends test AGT from the demo signer's stock to the caller's account so they
// can fund a hire. Gas + tokens are testnet-only.
//
// Only accounts that already exist on chain can claim: a freshly generated key
// has no account until someone pays to create it, so the drain loop "new random
// key per request" stops costing us and starts costing the caller.
export async function POST(req: Request) {
  try {
    throttle("faucet-ip", clientIp(req), 3, HOUR);

    const { publicKeyHex } = (await req.json()) as { publicKeyHex?: unknown };
    const recipient = parsePublicKey(publicKeyHex);

    const { rpc, cfg } = createReadClient();
    const signer = loadServerSigner();

    // The demo signer holds the faucet stock — a transfer to itself would
    // revert (CEP-18 rejects self-transfer). It is already funded; skip.
    if (recipient.accountHash().toPrefixedString() === signer.publicKey.accountHash().toPrefixedString()) {
      return NextResponse.json({ skipped: true });
    }

    try {
      await rpc.queryLatestBalance(PurseIdentifier.fromPublicKey(recipient));
    } catch {
      throw new GuardError(400, "This account does not exist on testnet yet — fund it with test CSPR first.");
    }

    throttle("faucet-key", recipient.toHex(), 1, HOUR);
    await ensureOperatorReserve(rpc, signer);

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

    return NextResponse.json({ txHash: tx.hash.toHex(), amountMotes: FAUCET_AMOUNT.toString() });
  } catch (e) {
    return errorResponse(e, "faucet failed");
  }
}
