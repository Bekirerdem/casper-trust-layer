/**
 * Faz 1+2 — LIVE x402 handshake against the hosted Casper facilitator.
 * Resource server (Express + WCSPR asset) + client (SDK pay()).
 * A real 402 -> EIP-712 sign -> facilitator /verify + /settle -> on-chain WCSPR transfer.
 *
 * Run: npx vite-node scripts/x402-handshake.mts
 * Spends REAL testnet WCSPR + facilitator settles on-chain.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import express from "express";
import { PrivateKey, KeyAlgorithm } from "casper-js-sdk";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactCasperScheme as ServerExactScheme } from "@make-software/casper-x402/exact/server";
import { toClientCasperSigner } from "@make-software/casper-x402";
import { CASPER_TEST } from "../src/config.js";
import { makeRpcClient } from "../src/rpc/client.js";
import { pay } from "../src/x402/index.js";

const WCSPR = "3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e";
const NETWORK = "casper:casper-test";
const PORT = 4021;
const AMOUNT = "1000000"; // 0.001 WCSPR (9 decimals)

const cfg = CASPER_TEST;
const sk = PrivateKey.fromPem(
  readFileSync(process.env.CASPER_SECRET_KEY_PEM!, "utf8"),
  KeyAlgorithm.SECP256K1,
);
const signer = toClientCasperSigner(sk);
const payTo = signer.accountAddress(); // 00 + account-hash (self-pay for the smoke test)

// --- facilitator client: Authorization: <token> (plain, no Bearer) ---
const authHeader = { Authorization: cfg.authToken! };
const facilitator = new HTTPFacilitatorClient({
  url: "https://x402-facilitator.cspr.cloud",
  createAuthHeaders: async () => ({
    verify: authHeader,
    settle: authHeader,
    supported: authHeader,
    list: authHeader,
    bazaar: authHeader,
  }),
} as any);

// --- server scheme: register WCSPR as a payable asset (9 decimals) ---
const serverScheme = new ServerExactScheme().registerAsset(NETWORK, WCSPR, 9);

// --- protected route ---
const routes = {
  "GET /premium": {
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        payTo,
        price: {
          asset: WCSPR,
          amount: AMOUNT,
          extra: { name: "Wrapped CSPR", version: "1", symbol: "WCSPR", decimals: "9" },
        },
      },
    ],
    description: "Premium agent data",
    mimeType: "application/json",
  },
};

async function main() {
  console.log("######## x402 LIVE HANDSHAKE ########");
  console.log(`payer    : ${signer.publicKey()}`);
  console.log(`payTo    : ${payTo}`);
  console.log(`asset    : WCSPR ${WCSPR}`);
  console.log(`amount   : ${AMOUNT} (0.001 WCSPR)`);

  const app = express();
  app.use(
    paymentMiddlewareFromConfig(routes as any, facilitator as any, [
      { network: NETWORK, server: serverScheme as any },
    ]),
  );
  app.get("/premium", (_req, res) =>
    res.json({ secret: "trust-gated agent payload", served: true }),
  );

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(PORT, () => {
      console.log(`\nresource server listening on :${PORT}`);
      resolve(s);
    });
  });

  // give the middleware a moment to sync /supported with the facilitator
  await new Promise((r) => setTimeout(r, 2000));

  const client = { cfg, rpc: makeRpcClient(cfg), signer, network: NETWORK } as any;
  console.log("\nclient calling /premium (expect 402 -> sign -> settle -> 200)...");
  try {
    const res = await pay(client, { url: `http://localhost:${PORT}/premium` });
    console.log(`\nHTTP status: ${res.status}`);
    const payResp =
      res.headers.get("payment-response") ?? res.headers.get("x-payment-response");
    console.log(`PAYMENT-RESPONSE header: ${payResp ?? "(none)"}`);
    const body = await res.text();
    console.log(`body: ${body}`);
    if (res.status === 200) {
      console.log("\n✅ HANDSHAKE OK — paid request settled, premium payload served.");
      if (payResp) {
        try {
          const decoded = JSON.parse(Buffer.from(payResp, "base64").toString("utf8"));
          console.log("settlement:", JSON.stringify(decoded, null, 2));
        } catch {
          /* not base64 json */
        }
      }
    } else {
      console.log("\n❌ unexpected status — see body above.");
    }
  } catch (e: any) {
    console.log("\n######## PAY ERROR ########");
    console.log(e?.message);
    console.log(String(e?.stack ?? "").split("\n").slice(0, 6).join("\n"));
  } finally {
    server.close();
  }
}

main().catch((e) => {
  console.log("\n######## SCRIPT ERROR ########");
  console.log(String(e?.stack ?? e));
  process.exitCode = 1;
});
