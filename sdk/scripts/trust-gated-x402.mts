/**
 * HERO DEMO — trust-gated x402 payment.
 * One provider, two thresholds:
 *   Scenario A (bar above provider score) -> payment REFUSED (TrustGateError, no settle)
 *   Scenario B (bar at/below score)        -> 402 handshake + on-chain WCSPR settle
 * Proves the thesis: payment is gated on objective, escrow-derived on-chain reputation.
 *
 * Run: npx vite-node scripts/trust-gated-x402.mts
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
import { resolvePackage } from "../src/rpc/resolve.js";
import { readOdraValue } from "../src/odra/read.js";
import { varKey } from "../src/odra/keys.js";
import { Reader, u32 } from "../src/odra/bytesrepr.js";
import { checkTrust } from "../src/trust/index.js";
import { pay, TrustGateError } from "../src/x402/index.js";

const WCSPR = "3d80df21ba4ee4d66a2a1f60c32570dd5685e4b279f6538162a5fd1314847c1e";
const NETWORK = "casper:casper-test";
const PORT = 4022;
const AMOUNT = "1000000"; // 0.001 WCSPR

const cfg = CASPER_TEST;
const rpc = makeRpcClient(cfg);
const c = { rpc, cfg };
const sk = PrivateKey.fromPem(
  readFileSync(process.env.CASPER_SECRET_KEY_PEM!, "utf8"),
  KeyAlgorithm.SECP256K1,
);
const signer = toClientCasperSigner(sk);
const payTo = signer.accountAddress();

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

const serverScheme = new ServerExactScheme().registerAsset(NETWORK, WCSPR, 9);

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

async function totalAgents(): Promise<number> {
  const { contractHash } = await resolvePackage(rpc, cfg.packages.identity);
  const raw = await readOdraValue(rpc, contractHash, varKey(cfg.fields.identity.count));
  return raw ? u32(new Reader(raw)) : 0;
}

/** Find a registered, Active provider with on-chain reputation > 0. */
async function findTrustedProvider(): Promise<{ id: number; score: bigint } | null> {
  const n = await totalAgents();
  for (let id = 0; id < n; id++) {
    const t = await checkTrust(c, id);
    if (t.exists && t.status === "Active" && t.score > 0n) {
      return { id, score: t.score };
    }
  }
  return null;
}

async function main() {
  console.log("######## HERO DEMO — TRUST-GATED x402 ########");

  const provider = await findTrustedProvider();
  if (!provider) {
    console.log("No Active provider with reputation > 0 found. Run hero-loop.mts first.");
    process.exitCode = 2;
    return;
  }
  const { id, score } = provider;
  console.log(`trusted provider: agent #${id}, on-chain scoreBps = ${score}`);

  const client = { cfg, rpc, signer, network: NETWORK } as any;

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
    const s = app.listen(PORT, () => resolve(s));
  });
  await new Promise((r) => setTimeout(r, 2000));

  try {
    // --- Scenario A: bar ABOVE provider's score -> must be refused ---
    const highBar = score + 1n;
    console.log(`\n--- Scenario A: require minScore ${highBar} (above ${score}) ---`);
    try {
      await pay(client, {
        url: `http://localhost:${PORT}/premium`,
        providerAgentId: id,
        minScore: highBar,
      });
      console.log("❌ UNEXPECTED: payment went through despite insufficient trust.");
    } catch (e) {
      if (e instanceof TrustGateError) {
        console.log(`✅ REFUSED by trust gate — no payment made. (${e.message})`);
      } else {
        throw e;
      }
    }

    // --- Scenario B: bar AT/BELOW provider's score -> settle on-chain ---
    const okBar = score; // scoreBps >= minScore passes
    console.log(`\n--- Scenario B: require minScore ${okBar} (met by ${score}) ---`);
    const res = await pay(client, {
      url: `http://localhost:${PORT}/premium`,
      providerAgentId: id,
      minScore: okBar,
    });
    console.log(`HTTP status: ${res.status}`);
    const payResp =
      res.headers.get("payment-response") ?? res.headers.get("x-payment-response");
    const body = await res.text();
    console.log(`body: ${body}`);
    if (res.status === 200 && payResp) {
      const decoded = JSON.parse(Buffer.from(payResp, "base64").toString("utf8"));
      console.log("✅ PAID — trust sufficient, x402 settled on-chain.");
      console.log(`   settle tx: ${decoded.transaction}`);
      console.log(`   explorer : https://testnet.cspr.live/transaction/${decoded.transaction}`);
    } else {
      console.log("❌ unexpected — see status/body above.");
    }

    console.log("\n######## RESULT ########");
    console.log("Same provider, same endpoint — only the trust bar changed.");
    console.log("Low reputation => payment refused.  Sufficient reputation => paid.");
  } finally {
    server.close();
  }
}

main().catch((e) => {
  console.log("\n######## SCRIPT ERROR ########");
  console.log(String(e?.stack ?? e));
  process.exitCode = 1;
});
