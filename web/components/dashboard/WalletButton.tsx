"use client";

import type { WalletState } from "@/lib/wallet/useCasperWallet";

function shortKey(k: string): string {
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}

type Props = Pick<WalletState, "connecting" | "publicKey" | "error"> & {
  connect: () => void;
  disconnect: () => void;
};

export function WalletButton({ connecting, publicKey, error, connect, disconnect }: Props) {
  if (publicKey) {
    return (
      <button
        onClick={disconnect}
        className="group inline-flex items-center gap-2.5 rounded-full border border-green-500/30 bg-ok/5 px-4 py-2 font-mono text-xs text-ink transition-all duration-300 hover:border-accent-red/40 hover:bg-accent-red/5"
        title="Disconnect"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
        </span>
        <span className="tabular-nums">{shortKey(publicKey)}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted group-hover:text-accent-red transition-colors">
          Disconnect
        </span>
      </button>
    );
  }

  // Not-found AND hang/timeout both point the user to the same fix: open the
  // extension and unlock it, then retry.
  const needsExtensionAction =
    !!error && /bulunamad|not detected|not found|did not respond|timed out/i.test(error);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={connect}
        disabled={connecting}
        className="inline-flex items-center gap-2.5 rounded-full bg-accent-red px-5 py-2 font-mono text-xs font-semibold uppercase tracking-widest text-bg shadow-md shadow-accent-red/20 transition-all duration-300 hover:bg-ink hover:text-bg disabled:opacity-60"
      >
        <span className={`h-1.5 w-1.5 rounded-full bg-white ${connecting ? "animate-ping" : ""}`} />
        {connecting ? "Connecting…" : "Connect Casper Wallet"}
      </button>
      {needsExtensionAction ? (
        <a
          href="https://www.casperwallet.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] text-muted hover:text-ink transition-colors"
        >
          Install or unlock the Casper Wallet extension, then retry ↗
        </a>
      ) : (
        error && <span className="font-mono text-[10px] text-accent-red">{error}</span>
      )}
    </div>
  );
}
