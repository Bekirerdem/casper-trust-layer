"use client";

/**
 * Wallet-signed vault actions.
 *
 * Same three steps as registering an agent: the server builds the unsigned
 * transaction, the customer's wallet signs it, the server re-attaches the
 * signature and submits. The server never signs for the customer — it is their
 * money and their rules, so the authority has to stay in their wallet.
 */

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

const bytesToHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");

export type VaultAction =
  | { action: "open"; perJob: string; perDay: string; requireTrackRecord: boolean }
  | { action: "approve"; amount: string }
  | { action: "deposit"; vaultId: number; amount: string }
  | { action: "withdraw"; vaultId: number; amount: string }
  | { action: "freeze"; vaultId: number }
  | { action: "unfreeze"; vaultId: number }
  | { action: "setRules"; vaultId: number; perJob: string; perDay: string; requireTrackRecord: boolean }
  | { action: "pay"; vaultId: number; payee: number; amount: string };

export async function runVaultAction(
  publicKeyHex: string,
  action: VaultAction,
): Promise<{ txHash: string }> {
  const provider = getProvider();
  if (!provider) throw new Error("Casper Wallet not found");

  const buildRes = await fetch("/api/vault/build", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ publicKeyHex, ...action }),
  });
  const built = await buildRes.json();
  if (!buildRes.ok) throw new Error(built.error ?? "could not prepare the transaction");
  const { txJson } = built as { txJson: unknown };

  const signFn = provider.signTransaction ?? provider.sign;
  if (!signFn) throw new Error("This wallet cannot sign transactions");
  const signed = await signFn.call(provider, JSON.stringify(txJson), publicKeyHex);
  if (signed?.cancelled) throw new Error("You cancelled the signature");
  const signatureHex =
    signed?.signatureHex ?? (signed?.signature ? bytesToHex(signed.signature) : null);
  if (!signatureHex) throw new Error("The wallet returned no signature");

  const subRes = await fetch("/api/register/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ txJson, signatureHex, publicKeyHex }),
  });
  const sub = await subRes.json();
  if (!subRes.ok) throw new Error(sub.error ?? "could not submit the transaction");
  return { txHash: sub.txHash as string };
}

/** Waits for the chain's verdict on a submitted action. */
export async function waitForVerdict(
  txHash: string,
): Promise<{ ok: boolean; error?: string }> {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await fetch(`/api/tx/status?hash=${txHash}`, { cache: "no-store" }).then((r) => r.json());
    if (!s.executed) continue;
    return { ok: !!s.success, error: s.error };
  }
  return { ok: false, error: "still pending" };
}
