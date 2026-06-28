"use client";

import { useCasperWallet } from "@/lib/wallet/useCasperWallet";

function shortKey(k: string): string {
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}

export function WalletButton() {
  const { available, connecting, publicKey, error, connect, disconnect } = useCasperWallet();

  if (publicKey) {
    return (
      <button
        onClick={disconnect}
        className="group inline-flex items-center gap-2.5 rounded-full border border-green-500/30 bg-green-500/5 px-4 py-2 font-mono text-xs text-white transition-all duration-300 hover:border-accent-red/40 hover:bg-accent-red/5"
        title="Click to disconnect"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        <span className="tabular-nums">{shortKey(publicKey)}</span>
        <span className="text-[10px] uppercase tracking-widest text-[#8E8E93] group-hover:text-accent-red transition-colors">
          Disconnect
        </span>
      </button>
    );
  }

  if (!available) {
    return (
      <a
        href="https://www.casperwallet.io/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 font-mono text-xs text-[#8E8E93] transition-all duration-300 hover:border-white/30 hover:text-white"
      >
        Install Casper Wallet ↗
      </a>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={connecting}
      className="inline-flex items-center gap-2.5 rounded-full bg-accent-red px-5 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-white shadow-md shadow-accent-red/20 transition-all duration-300 hover:bg-white hover:text-black disabled:opacity-60"
    >
      <span className={`h-1.5 w-1.5 rounded-full bg-white ${connecting ? "animate-ping" : ""}`} />
      {connecting ? "Connecting…" : "Connect Casper Wallet"}
      {error && <span className="ml-1 normal-case tracking-normal text-white/70">· {error}</span>}
    </button>
  );
}
