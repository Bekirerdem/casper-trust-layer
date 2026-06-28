"use client";

// Full wallet-signed register flow:
//   1. server builds the unsigned Transaction (casper-js-sdk, proven server-side)
//   2. Casper Wallet signs it in the browser
//   3. server re-attaches the signature + submits via cspr.cloud
// Keeps casper-js-sdk + the token off the browser; the wallet is the only
// browser-side Casper dependency.

type SignResult = { cancelled?: boolean; signature?: Uint8Array; signatureHex?: string };
type Provider = {
  signTransaction?: (txJson: string, pubKeyHex: string) => Promise<SignResult>;
  sign?: (txJson: string, pubKeyHex: string) => Promise<SignResult>;
};

function getProvider(): Provider | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & { CasperWalletProvider?: (o?: unknown) => Provider };
  try {
    return typeof w.CasperWalletProvider === "function" ? w.CasperWalletProvider() : null;
  } catch {
    return null;
  }
}

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function registerAgent(opts: {
  publicKeyHex: string;
  agentUri: string;
  bondMotes: string;
}): Promise<{ txHash: string }> {
  const provider = getProvider();
  if (!provider) throw new Error("Casper Wallet bulunamadı");

  // 1. build (server)
  const buildRes = await fetch("/api/register/build", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(opts),
  });
  const built = await buildRes.json();
  if (!buildRes.ok) throw new Error(`build: ${built.error ?? buildRes.status}`);
  const { txJson } = built as { txJson: unknown };

  // 2. sign (wallet)
  const signFn = provider.signTransaction ?? provider.sign;
  if (!signFn) throw new Error("cüzdan signTransaction desteklemiyor");
  const signed = await signFn.call(provider, JSON.stringify(txJson), opts.publicKeyHex);
  if (signed?.cancelled) throw new Error("imza iptal edildi");
  const signatureHex =
    signed?.signatureHex ?? (signed?.signature ? bytesToHex(signed.signature) : null);
  if (!signatureHex) throw new Error("cüzdan imza döndürmedi");

  // 3. submit (server, token-safe)
  const subRes = await fetch("/api/register/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ txJson, signatureHex, publicKeyHex: opts.publicKeyHex }),
  });
  const sub = await subRes.json();
  if (!subRes.ok) throw new Error(`submit: ${sub.error ?? subRes.status}`);
  return { txHash: sub.txHash as string };
}
