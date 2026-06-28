"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Minimal Casper Wallet connection hook — uses the browser-extension provider
 * (window.CasperWalletProvider), no extra dependency. Read-only connect:
 * request connection + read the active public key, listen for key changes.
 * Signing (write txs) is a separate, heavier path and not handled here.
 */

type CasperWalletProvider = {
  requestConnection: () => Promise<boolean>;
  isConnected: () => Promise<boolean>;
  getActivePublicKey: () => Promise<string>;
  disconnectFromSite: () => Promise<boolean>;
};

type WalletWindow = Window & {
  CasperWalletProvider?: (opts?: unknown) => CasperWalletProvider;
  CasperWalletEventTypes?: Record<string, string>;
};

export type WalletState = {
  available: boolean;
  connecting: boolean;
  publicKey: string | null;
  error: string | null;
};

function getProvider(): CasperWalletProvider | null {
  if (typeof window === "undefined") return null;
  const w = window as WalletWindow;
  return typeof w.CasperWalletProvider === "function" ? w.CasperWalletProvider() : null;
}

export function useCasperWallet() {
  const [state, setState] = useState<WalletState>({
    available: false,
    connecting: false,
    publicKey: null,
    error: null,
  });

  // Detect extension + restore an existing session.
  useEffect(() => {
    const provider = getProvider();
    if (!provider) {
      setState((s) => ({ ...s, available: false }));
      return;
    }
    setState((s) => ({ ...s, available: true }));
    provider
      .isConnected()
      .then((ok) => (ok ? provider.getActivePublicKey() : null))
      .then((key) => key && setState((s) => ({ ...s, publicKey: key })))
      .catch(() => {});

    // React to account / connection changes from the extension.
    const w = window as WalletWindow;
    const types = w.CasperWalletEventTypes;
    if (!types) return;
    const onChange = (e: Event) => {
      try {
        const detail = JSON.parse((e as CustomEvent).detail ?? "{}");
        setState((s) => ({ ...s, publicKey: detail.isConnected ? detail.activeKey ?? s.publicKey : null }));
      } catch {
        /* ignore malformed event */
      }
    };
    const onDisconnect = () => setState((s) => ({ ...s, publicKey: null }));
    window.addEventListener(types.ActiveKeyChanged, onChange);
    window.addEventListener(types.Connected, onChange);
    window.addEventListener(types.Disconnected, onDisconnect);
    return () => {
      window.removeEventListener(types.ActiveKeyChanged, onChange);
      window.removeEventListener(types.Connected, onChange);
      window.removeEventListener(types.Disconnected, onDisconnect);
    };
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setState((s) => ({ ...s, error: "Casper Wallet not detected" }));
      return;
    }
    setState((s) => ({ ...s, connecting: true, error: null }));
    try {
      const ok = await provider.requestConnection();
      const key = ok ? await provider.getActivePublicKey() : null;
      setState((s) => ({ ...s, connecting: false, publicKey: key }));
    } catch (e) {
      setState((s) => ({
        ...s,
        connecting: false,
        error: e instanceof Error ? e.message : "connection failed",
      }));
    }
  }, []);

  const disconnect = useCallback(async () => {
    const provider = getProvider();
    try {
      await provider?.disconnectFromSite();
    } catch {
      /* ignore */
    }
    setState((s) => ({ ...s, publicKey: null }));
  }, []);

  return { ...state, connect, disconnect };
}
