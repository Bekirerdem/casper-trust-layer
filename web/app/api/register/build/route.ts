import { NextResponse } from "next/server";
import {
  Args,
  CLValue,
  CLTypeUInt8,
  SessionBuilder,
  PublicKey,
} from "casper-js-sdk";
import { createReadClient } from "@/lib/casper/read";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REGISTER_GAS = 15_000_000_000; // wasm-lane register (proxy purse + cross-call)

// Builds an UNSIGNED register Transaction for the caller's public key, routed
// through proxy_caller_with_return.wasm (same construction as the SDK's
// buildRegister, minus the PrivateKey signature — the browser wallet signs it).
export async function POST(req: Request) {
  try {
    const { publicKeyHex, agentUri, bondMotes } = (await req.json()) as {
      publicKeyHex: string;
      agentUri: string;
      bondMotes: string;
    };
    if (!publicKeyHex || !agentUri || !bondMotes) {
      return NextResponse.json({ error: "publicKeyHex, agentUri, bondMotes gerekli" }, { status: 400 });
    }

    const { cfg } = createReadClient();
    const from = PublicKey.fromHex(publicKeyHex);

    // proxy_caller wasm is served from /public — fetch it from this origin.
    const wasmRes = await fetch(new URL("/proxy_caller_with_return.wasm", req.url));
    if (!wasmRes.ok) throw new Error("proxy_caller wasm fetch failed");
    const wasm = new Uint8Array(await wasmRes.arrayBuffer());

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
          attached_value: CLValue.newCLUInt512(bondMotes),
          amount: CLValue.newCLUInt512(bondMotes),
        }),
      )
      .chainName(cfg.chainName)
      .payment(REGISTER_GAS)
      .build();

    return NextResponse.json({ txJson: tx.toJSON(), hash: tx.hash.toHex() });
  } catch (e) {
    const message = e instanceof Error ? e.message : "build failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
