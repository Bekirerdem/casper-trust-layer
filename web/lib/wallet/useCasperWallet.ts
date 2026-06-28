"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Casper Wallet connection hook — uses the browser-extension provider
 * (window.CasperWalletProvider), no extra dependency.
 *
 * The extension injects the provider ASYNCHRONOUSLY after page load, so a
 * one-shot check on mount often misses it (shows "not installed" falsely).
 * We poll for it for a few seconds and also re-check at click time.
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
  try {
    return typeof w.CasperWalletProvider === "function" ? w.CasperWalletProvider() : null;
  } catch {
    return null;
  }
}

// event.detail may be a JSON string OR an object depending on extension version.
function parseDetail(detail: unknown): { activeKey?: string; isConnected?: boolean; isUnlocked?: boolean } {
  if (!detail) return {};
  if (typeof detail === "object") return detail as Record<string, unknown>;
  try {
    return JSON.parse(String(detail));
  } catch {
    return {};
  }
}

export function useCasperWallet() {
  const [state, setState] = useState<WalletState>({
    available: false,
    connecting: false,
    publicKey: null,
    error: null,
  });
  const restored = useRef(false);

  // Poll for the (async-injected) provider, then wire events + restore session.
  useEffect(() => {
    let cancelled = false;
    let tries = 0;

    const restoreSession = (provider: CasperWalletProvider) => {
      if (restored.current) return;
      restored.current = true;
      // isConnected() throws when the wallet is locked — treat as "not connected".
      provider
        .isConnected()
        .then((ok) => (ok ? provider.getActivePublicKey() : null))
        .then((key) => !cancelled && key && setState((s) => ({ ...s, publicKey: key })))
        .catch(() => {});
    };

    const wireEvents = () => {
      const w = window as WalletWindow;
      const types = w.CasperWalletEventTypes;
      if (!types) return () => {};
      const onChange = (e: Event) => {
        const d = parseDetail((e as CustomEvent).detail);
        setState((s) => ({ ...s, publicKey: d.isConnected === false ? null : d.activeKey ?? s.publicKey }));
      };
      const onDisconnect = () => setState((s) => ({ ...s, publicKey: null }));
      window.addEventListener(types.ActiveKeyChanged, onChange);
      window.addEventListener(types.Connected, onChange);
      window.addEventListener(types.Unlocked, onChange);
      window.addEventListener(types.Disconnected, onDisconnect);
      window.addEventListener(types.Locked, onDisconnect);
      return () => {
        window.removeEventListener(types.ActiveKeyChanged, onChange);
        window.removeEventListener(types.Connected, onChange);
        window.removeEventListener(types.Unlocked, onChange);
        window.removeEventListener(types.Disconnected, onDisconnect);
        window.removeEventListener(types.Locked, onDisconnect);
      };
    };

    let cleanupEvents = () => {};
    const tick = () => {
      if (cancelled) return;
      const provider = getProvider();
      if (provider) {
        setState((s) => ({ ...s, available: true }));
        cleanupEvents = wireEvents();
        restoreSession(provider);
        return; // found — stop polling
      }
      if (++tries < 16) setTimeout(tick, 500); // ~8s window
    };
    tick();

    return () => {
      cancelled = true;
      cleanupEvents();
    };
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      setState((s) => ({ ...s, available: false, error: "Casper Wallet bulunamadı — eklenti kurulu+açık mı?" }));
      return;
    }
    setState((s) => ({ ...s, available: true, connecting: true, error: null }));
    try {
      const ok = await provider.requestConnection();
      const key = ok ? await provider.getActivePublicKey() : null;
      setState((s) => ({ ...s, connecting: false, publicKey: key, error: ok ? null : "bağlantı reddedildi" }));
    } catch (e) {
      setState((s) => ({
        ...s,
        connecting: false,
        error: e instanceof Error ? e.message : "bağlantı başarısız",
      }));
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await getProvider()?.disconnectFromSite();
    } catch {
      /* ignore */
    }
    setState((s) => ({ ...s, publicKey: null }));
  }, []);

  return { ...state, connect, disconnect };
}
