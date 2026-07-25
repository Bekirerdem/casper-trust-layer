"use client";

import { useEffect, useState } from "react";

type Envelope = {
  perTaskLimit: string;
  dailyLimit: string;
  minReputation: number;
  paused: boolean;
};

type Phase = "idle" | "sending" | "pending" | "blocked" | "sent" | "error";

/**
 * Why a payment was refused, in the words of the person whose money it is.
 * Keyed by the contract's error codes, which nobody outside this repo should
 * ever have to read.
 */
const BLOCKED_BECAUSE: Record<string, string> = {
  "4": "this vendor isn't on your approved list",
  "5": "this vendor has no completed jobs yet",
  "6": "it's over your per-job limit",
  "7": "it's over your daily limit",
  "8": "there isn't enough left in the account",
  "12": "you've frozen spending",
};

const money = (raw: string) => `$${Math.round(Number(raw) / 1e9).toLocaleString("en-US")}`;

export function LiveEnvelopeCard({ unprovenAgentId }: { unprovenAgentId: number }) {
  const [env, setEnv] = useState<Envelope | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/treasury", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Envelope | null) => {
        if (!cancelled && d && !("error" in d)) setEnv(d);
      })
      .catch(() => {
        /* card falls back to its labels */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function attempt() {
    setPhase("sending");
    setTxHash(null);
    setReason(null);
    try {
      const res = await fetch("/api/treasury/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payee: unprovenAgentId, amountAgt: "0.001" }),
      });
      const d = await res.json();
      if (!res.ok) {
        setPhase("error");
        setReason(d.error ?? "Something went wrong. Try again in a moment.");
        return;
      }
      setTxHash(d.txHash);
      setPhase("pending");

      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const s = await fetch(`/api/tx/status?hash=${d.txHash}`, { cache: "no-store" }).then((r) => r.json());
        if (!s.executed) continue;
        if (s.success) {
          setPhase("sent");
        } else {
          const code = String(s.error ?? "").match(/User error: (\d+)/)?.[1];
          setReason((code && BLOCKED_BECAUSE[code]) || "your rules didn't allow it");
          setPhase("blocked");
        }
        return;
      }
      setPhase("error");
      setReason("Still processing — check the receipt.");
    } catch {
      setPhase("error");
      setReason("Something went wrong. Try again in a moment.");
    }
  }

  const running = phase === "sending" || phase === "pending";

  return (
    <div className="glass-panel relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <span className="font-sans text-sm font-bold text-white">Spending limits</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">
          Demo account
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-5 py-6">
        <div className="flex flex-col gap-1">
          <dt className="font-sans text-xs text-[#8E8E93]">Per job</dt>
          <dd className="font-sans text-2xl font-black tabular-nums text-white">
            {env ? money(env.perTaskLimit) : "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-sans text-xs text-[#8E8E93]">Per day</dt>
          <dd className="font-sans text-2xl font-black tabular-nums text-white">
            {env ? money(env.dailyLimit) : "—"}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/40 px-4 py-2.5">
          <span className="font-sans text-xs text-[#8E8E93]">Who can be paid</span>
          <span className="font-sans text-xs font-semibold text-white">
            Vendors with completed jobs
          </span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/40 px-4 py-2.5">
          <span className="font-sans text-xs text-[#8E8E93]">Spending</span>
          <span
            className={`font-sans text-xs font-semibold ${
              env?.paused ? "text-accent-red" : "text-green-400"
            }`}
          >
            {env ? (env.paused ? "Frozen" : "Active") : "—"}
          </span>
        </div>
      </div>

      {/* The demo: ask it to break a rule */}
      <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5">
        <p className="font-sans text-sm leading-relaxed text-[#8E8E93]">
          Your agent found a vendor nobody has ever paid. Tell it to send money anyway.
        </p>

        <button
          onClick={attempt}
          disabled={running || !env}
          className="inline-flex items-center justify-center gap-2.5 rounded-full bg-accent-red px-6 py-3 font-sans text-sm font-semibold text-white shadow-lg shadow-accent-red/20 transition-all duration-300 hover:bg-white hover:text-black disabled:opacity-50"
        >
          <span className={`h-1.5 w-1.5 rounded-full bg-current ${running ? "animate-ping" : ""}`} />
          {phase === "sending" ? "Sending…" : phase === "pending" ? "Checking…" : "Pay an unknown vendor"}
        </button>

        {phase !== "idle" && (
          <div className="font-sans text-[13px] leading-relaxed">
            {phase === "pending" && <span className="text-[#8E8E93]">Checking your rules…</span>}
            {phase === "blocked" && (
              <span className="font-semibold text-accent-red">
                Blocked — {reason}. Your money didn&apos;t move.
              </span>
            )}
            {phase === "sent" && (
              <span className="font-semibold text-green-400">Sent — this vendor cleared your rules.</span>
            )}
            {phase === "error" && <span className="text-[#8E8E93]">{reason}</span>}
            {txHash && (
              <a
                href={`https://testnet.cspr.live/transaction/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-[#8E8E93] underline decoration-white/20 transition-colors hover:text-white"
              >
                See the receipt ↗
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
