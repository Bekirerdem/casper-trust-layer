import type { TrustClient } from "../trust/index.js";
import { checkTrust } from "../trust/index.js";
import { ExactCasperScheme, NETWORK_CASPER_TESTNET } from "@make-software/casper-x402";
import { wrapFetchWithPayment } from "@x402/fetch";
import { x402Client } from "@x402/core/client";

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
 * toClientCasperSigner from @make-software/casper-x402.
 * The package does not export a named interface type — this mirrors the
 * return type of toClientCasperSigner() exactly.
 */
export interface CasperClientSigner {
  accountAddress(): string;
  publicKey(): string;
  signEIP712(digest: Uint8Array): Promise<Uint8Array>;
}

/**
 * Extended TrustClient that carries an x402 client signer.
 *
 * Delegation: pay() builds an x402Client (from @x402/core) registered with
 * ExactCasperScheme and delegates the 402-handshake to wrapFetchWithPayment
 * from @x402/fetch.  That wrapper owns the retry loop and sets the
 * PAYMENT-SIGNATURE header (x402 v2 wire contract — v1 used X-PAYMENT).
 */
export interface X402TrustClient extends TrustClient {
  signer: CasperClientSigner;
  /** CAIP-2 network override; defaults to NETWORK_CASPER_TESTNET ("casper:casper-test") */
  network?: string;
}

// ---------------------------------------------------------------------------
// pay() — trust-gated x402 payment
// ---------------------------------------------------------------------------

/**
 * Trust-gated x402 v2 payment wrapper.
 *
 * 1. Gates on the provider's on-chain trust score (throws TrustGateError if below minScore).
 * 2. Delegates the 402-handshake to wrapFetchWithPayment (@x402/fetch), which:
 *    - Detects the 402 response
 *    - Calls x402Client.createPaymentPayload (dispatches to ExactCasperScheme)
 *    - Retries with PAYMENT-SIGNATURE header (x402 v2 wire name; v1 was X-PAYMENT)
 *    - Uses amount field from paymentRequirements (x402 v2 — not maxAmountRequired)
 *
 * Integration note: live facilitator not exercised here; the 402-loop is
 * verified at the unit level via the gating tests. The handshake will be
 * exercised end-to-end in the dashboard/demo task.
 */
export async function pay(c: X402TrustClient, req: PayRequest): Promise<Response> {
  // Step 1: gate
  await gateByTrust(
    (id, o) => checkTrust(c, id, o),
    req.providerAgentId,
    req.minScore,
  );

  // Step 2: build x402Client with ExactCasperScheme and delegate the 402-loop
  // x402 v2 wire: amount (not maxAmountRequired), PAYMENT-SIGNATURE header
  // Network defaults to casper:casper-test per research §2 (CAIP-2 identifier)
  const network = c.network ?? NETWORK_CASPER_TESTNET;
  const client = new x402Client();
  client.register(network as `${string}:${string}`, new ExactCasperScheme(c.signer));

  const paymentFetch = wrapFetchWithPayment(fetch, client);
  return paymentFetch(req.url, req.init);
}
