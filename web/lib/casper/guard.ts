import { NextResponse } from "next/server";
import { PublicKey, PurseIdentifier, type PrivateKey, type RpcClient } from "casper-js-sdk";

/**
 * Spend guards for the routes that make the server key sign.
 *
 * Every server-signed transaction burns real gas whether it settles or reverts,
 * so those routes are only allowed to sign when (1) the request is well-formed,
 * (2) the chain state says the call can do something useful, and (3) the
 * operator account still holds its reserve. The per-instance throttle is a
 * secondary brake: serverless instances don't share it, the on-chain checks are
 * what actually bound the spend.
 */

/**
 * Below this the demo stops signing. The demo signer is funded with a few
 * hundred CSPR on purpose, so the most a drain can burn is that float.
 */
const OPERATOR_RESERVE_MOTES = BigInt(50) * BigInt(1_000_000_000); // 50 CSPR

/** An error whose message is safe to show the caller. */
export class GuardError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Turns any thrown error into a response without leaking RPC/SDK internals. */
export function errorResponse(e: unknown, fallback: string, status = 500) {
  if (e instanceof GuardError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  console.error(`[api] ${fallback}:`, e);
  return NextResponse.json({ error: fallback }, { status });
}

/** The caller's IP as Vercel's edge saw it — not the spoofable first hop. */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
    "local"
  );
}

const MAX_TRACKED_KEYS = 5_000;
const buckets = new Map<string, Map<string, number[]>>();

/** Sliding-window limiter: throws 429 when `key` exceeds `max` hits per window. */
export function throttle(bucket: string, key: string, max: number, windowMs: number) {
  let hits = buckets.get(bucket);
  if (!hits) {
    hits = new Map();
    buckets.set(bucket, hits);
  }
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    throw new GuardError(429, "Too many attempts — each one spends real testnet gas. Try again shortly.");
  }
  recent.push(now);
  if (hits.size >= MAX_TRACKED_KEYS) hits.delete(hits.keys().next().value as string);
  hits.set(key, recent);
}

/** Refuses to sign once the operator account is down to its reserve. */
export async function ensureOperatorReserve(rpc: RpcClient, signer: PrivateKey) {
  const res = await rpc.queryLatestBalance(PurseIdentifier.fromPublicKey(signer.publicKey));
  if (BigInt(res.balance.toString()) < OPERATOR_RESERVE_MOTES) {
    throw new GuardError(503, "The demo signer is paused (low testnet balance). Try again later.");
  }
}

const PUBLIC_KEY_RE = /^(01[0-9a-f]{64}|02[0-9a-f]{66})$/;

/** Parses a Casper public key hex (ed25519 or secp256k1) or throws 400. */
export function parsePublicKey(hex: unknown): PublicKey {
  if (typeof hex !== "string" || !PUBLIC_KEY_RE.test(hex.toLowerCase())) {
    throw new GuardError(400, "invalid public key");
  }
  return PublicKey.fromHex(hex.toLowerCase());
}

/** Parses an unsigned integer id (u32/u64 range) or throws 400. */
export function parseId(value: unknown, name: string, max: bigint = BigInt("18446744073709551615")): bigint {
  const s = typeof value === "number" ? String(value) : value;
  if (typeof s !== "string" || !/^\d{1,20}$/.test(s) || BigInt(s) > max) {
    throw new GuardError(400, `invalid ${name}`);
  }
  return BigInt(s);
}

/**
 * Parses a decimal token amount ("1.5") into base units without going through
 * floating point. Throws 400 on malformed, zero or over-`maxWhole` amounts.
 */
export function parseAmount(
  value: unknown,
  decimals: number,
  maxWhole: number,
  { allowZero = false }: { allowZero?: boolean } = {},
): bigint {
  const s = typeof value === "number" ? String(value) : value;
  if (typeof s !== "string" || !/^\d{1,12}(\.\d+)?$/.test(s)) {
    throw new GuardError(400, "invalid amount");
  }
  const [whole, frac = ""] = s.split(".");
  if (frac.length > decimals) throw new GuardError(400, "invalid amount");
  const units = BigInt(whole) * BigInt(10) ** BigInt(decimals) + BigInt(frac.padEnd(decimals, "0") || "0");
  if ((units === BigInt(0) && !allowZero) || BigInt(whole) > BigInt(maxWhole)) {
    throw new GuardError(400, "invalid amount");
  }
  return units;
}
