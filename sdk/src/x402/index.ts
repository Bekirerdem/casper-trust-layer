import type { TrustClient } from "../trust/index.js";
import { checkTrust } from "../trust/index.js";
import { ExactCasperScheme } from "@make-software/casper-x402";

// ---------------------------------------------------------------------------
// Trust gate
// ---------------------------------------------------------------------------

export class TrustGateError extends Error {
  constructor(
    public readonly agentId: number,
    public readonly score: bigint,
    public readonly minScore: bigint,
  ) {
    super(`agent ${agentId} score ${score} < required ${minScore}`);
    this.name = "TrustGateError";
  }
}

type CheckFn = (
  agentId: number,
  opts: { minScore?: bigint },
) => Promise<{ trusted: boolean; score: bigint }>;

/**
 * Pure gate: throws TrustGateError if a provider is below threshold.
 * No-op when minScore or providerAgentId is undefined.
 */
export async function gateByTrust(
  check: CheckFn,
  providerAgentId?: number,
  minScore?: bigint,
): Promise<void> {
  if (minScore === undefined || providerAgentId === undefined) return;
  const r = await check(providerAgentId, { minScore });
  if (!r.trusted) throw new TrustGateError(providerAgentId, r.score, minScore);
}

// ---------------------------------------------------------------------------
// Pay request / client interface
// ---------------------------------------------------------------------------

export interface PayRequest {
  url: string;
  providerAgentId?: number;
  minScore?: bigint;
  init?: RequestInit;
}

/**
 * The x402 client signer shape produced by createClientCasperSigner /
 * toClientCasperSigner from @make-software/casper-x402 0.1.0.
 * The package does not export a named interface type — this mirrors the
 * return type of toClientCasperSigner() exactly.
 */
export interface CasperClientSigner {
  accountAddress(): string;
  publicKey(): string;
  signEIP712(digest: Uint8Array): Promise<Uint8Array>;
}

/**
 * Extended TrustClient that carries an x402 client signer and the
 * facilitator URL needed to complete the payment handshake.
 *
 * NOTE on the official client API (0.1.0 findings):
 *   @make-software/casper-x402 does NOT ship a wrapFetchWithPayment() or an
 *   x402Fetch helper.  The payment client surface is:
 *     - ExactCasperScheme(signer) — creates payloads via createPaymentPayload()
 *     - createClientCasperSigner(pemPath) / toClientCasperSigner(privateKey)
 *   There is no standalone fetch-wrapper; callers must implement the x402
 *   402-handshake (fetch → 402 → retry with X-PAYMENT header) manually using
 *   ExactCasperScheme.createPaymentPayload().  This wrapper does exactly that.
 */
export interface X402TrustClient extends TrustClient {
  signer: CasperClientSigner;
  /** e.g. "https://x402-facilitator.cspr.cloud" */
  facilitatorUrl: string;
}

// ---------------------------------------------------------------------------
// pay() — trust-gated x402 payment
// ---------------------------------------------------------------------------

const X402_VERSION = 1;

/**
 * Trust-gated x402 payment wrapper.
 *
 * 1. Gates on the provider's on-chain trust score (throws TrustGateError if below minScore).
 * 2. Performs the x402 402-handshake via ExactCasperScheme from @make-software/casper-x402.
 *
 * Integration assumptions (live facilitator not exercised here):
 *  - The facilitator at c.facilitatorUrl returns a 402 with a JSON body conforming
 *    to the x402 PaymentRequired spec (paymentRequirements array).
 *  - The retry with X-PAYMENT header is the standard x402 client loop.
 *  - ExactCasperScheme.createPaymentPayload() produces a base64-encodable payload
 *    suitable for the X-PAYMENT header value (JSON-encoded).
 */
export async function pay(c: X402TrustClient, req: PayRequest): Promise<Response> {
  // Step 1: gate
  await gateByTrust(
    (id, o) => checkTrust(c, id, o),
    req.providerAgentId,
    req.minScore,
  );

  // Step 2: attempt fetch
  const scheme = new ExactCasperScheme(c.signer);
  const initialResponse = await fetch(req.url, req.init);

  if (initialResponse.status !== 402) {
    return initialResponse;
  }

  // Step 3: parse payment requirements from 402 body
  let paymentRequirements: unknown;
  try {
    const body = await initialResponse.json() as { paymentRequirements?: unknown[] };
    const reqs = body.paymentRequirements;
    if (!Array.isArray(reqs) || reqs.length === 0) {
      throw new Error("no paymentRequirements in 402 response body");
    }
    // Pick the first exact/casper requirement
    paymentRequirements = reqs[0];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`x402: failed to parse 402 body: ${msg}`);
  }

  // Step 4: create payment payload and retry
  const payloadResult = await scheme.createPaymentPayload(
    X402_VERSION,
    paymentRequirements as Parameters<ExactCasperScheme["createPaymentPayload"]>[1],
  );

  const paymentHeader = btoa(JSON.stringify(payloadResult));
  const retryInit: RequestInit = {
    ...req.init,
    headers: {
      ...(req.init?.headers as Record<string, string> | undefined),
      "X-PAYMENT": paymentHeader,
    },
  };

  return fetch(req.url, retryInit);
}
