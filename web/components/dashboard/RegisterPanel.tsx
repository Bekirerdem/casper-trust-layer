"use client";

import { useState } from "react";
import { registerAgent } from "@/lib/wallet/registerAgent";

const BOND_CSPR = 10;
const BOND_MOTES = String(BOND_CSPR * 1_000_000_000);

export function RegisterPanel({ publicKey }: { publicKey: string }) {
  const [agentUri, setAgentUri] = useState("ipfs://my-agent-card");
  const [status, setStatus] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRegister() {
    setStatus("pending");
    setError(null);
    setTxHash(null);
    try {
      const { txHash } = await registerAgent({ publicKeyHex: publicKey, agentUri, bondMotes: BOND_MOTES });
      setTxHash(txHash);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "register failed");
      setStatus("error");
    }
  }

  return (
    <section className="glass-panel bg-white/5 border-accent-red/20 rounded-2xl p-6 md:p-8 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-accent-red">
          Register your agent · wallet-signed
        </h2>
        <span className="font-mono text-[10px] text-green-400">● cüzdan bağlı</span>
      </div>

      <p className="font-sans text-sm text-[#8E8E93] mb-4 leading-relaxed max-w-[60ch]">
        Bağlı cüzdanınla trust ağına gerçek bir agent olarak katıl. {BOND_CSPR} CSPR bond yatırılır,
        Casper Wallet imzalar, işlem zincire gider — tüm akış canlı.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
        <label className="flex flex-col gap-1.5 flex-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">Agent metadata URI</span>
          <input
            value={agentUri}
            onChange={(e) => setAgentUri(e.target.value)}
            className="rounded-lg border border-white/15 bg-black/40 px-4 py-2.5 font-mono text-sm text-white focus:border-accent-red/50 focus:outline-none"
            placeholder="ipfs://…"
          />
        </label>
        <button
          onClick={onRegister}
          disabled={status === "pending" || !agentUri.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent-red px-6 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-white transition-all duration-300 hover:bg-white hover:text-black disabled:opacity-50"
        >
          <span className={`h-1.5 w-1.5 rounded-full bg-white ${status === "pending" ? "animate-ping" : ""}`} />
          {status === "pending" ? "İmzala & gönder…" : `Register (${BOND_CSPR} CSPR)`}
        </button>
      </div>

      {status === "done" && txHash && (
        <a
          href={`https://testnet.cspr.live/transaction/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 font-mono text-xs text-green-400 hover:text-white transition-colors"
        >
          ✓ Zincirde — {txHash.slice(0, 12)}… cspr.live'da doğrula ↗
        </a>
      )}
      {status === "error" && error && (
        <p className="mt-4 font-mono text-xs text-accent-red break-all">✕ {error}</p>
      )}
    </section>
  );
}
