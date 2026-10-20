import { NextResponse } from "next/server";
import {
  Args,
  CLValue,
  CLTypeUInt8,
  SessionBuilder,
} from "casper-js-sdk";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createReadClient } from "@/lib/casper/read";
import { GuardError, errorResponse, parseId, parsePublicKey } from "@/lib/casper/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REGISTER_GAS = 15_000_000_000; // wasm-lane register (proxy purse + cross-call)
const MAX_URI = 256;

// Builds an UNSIGNED register Transaction for the caller's public key, routed
// through proxy_caller_with_return.wasm (same construction as the SDK's
// buildRegister, minus the PrivateKey signature — the browser wallet signs it).
export async function POST(req: Request) {
  try {
    const { publicKeyHex, agentUri, bondMotes } = (await req.json()) as {
      publicKeyHex?: unknown;
      agentUri?: unknown;
      bondMotes?: unknown;
    };
    const from = parsePublicKey(publicKeyHex);
    if (typeof agentUri !== "string" || agentUri.length === 0 || agentUri.length > MAX_URI) {
      throw new GuardError(400, `agentUri must be 1-${MAX_URI} characters`);
    }
    const bond = parseId(bondMotes, "bondMotes");

    const { cfg } = createReadClient();

    // proxy_caller wasm ships in /public — read it from disk, never via the
    // request's Host header.
    const wasm = new Uint8Array(await readFile(join(process.cwd(), "public", "proxy_caller_with_return.wasm")));

    // Inner args forwarded by proxy_caller to identity::register.
    const innerBytes = Args.fromMap({ agent_uri: CLValue.newCLString(agentUri) }).toBytes();
    const pkgBytes = Uint8Array.from(Buffer.from(cfg.packages.identity, "hex"));
    const innerArgsList = CLValue.newCLList(
      CLTypeUInt8,
      Array.from(innerBytes, (b) => CLValue.newCLUint8(b)),
    );

    const tx = new SessionBuilder()
      .from(from)
      .wasm(wasm)
      .runtimeArgs(
        Args.fromMap({
          package_hash: CLValue.newCLByteArray(pkgBytes),
          entry_point: CLValue.newCLString("register"),
          args: innerArgsList,
          attached_value: CLValue.newCLUInt512(bond.toString()),
          amount: CLValue.newCLUInt512(bond.toString()),
        }),
      )
      .chainName(cfg.chainName)
      .payment(REGISTER_GAS)
      .build();

    return NextResponse.json({ txJson: tx.toJSON(), hash: tx.hash.toHex() });
  } catch (e) {
    return errorResponse(e, "build failed");
  }
}
