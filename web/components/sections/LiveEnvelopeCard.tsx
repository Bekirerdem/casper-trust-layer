"use client";

import { useEffect, useState } from "react";

type Envelope = {
  perTaskLimit: string;
  dailyLimit: string;
  minReputation: number;
  paused: boolean;
};

type Phase = "idle" | "sending" | "pending" | "reverted" | "settled" | "error";

const REVERT_MEANING: Record<string, string> = {
  "4": "not whitelisted, and no reputation policy is active",
  "5": "earned score is below the owner's bar",
  "6": "over the per-task cap",
  "7": "over the daily cap",
  "8": "no unlocked funds left",
  "12": "the owner has pulled the brake",
};

const agt = (motes: string) => Math.round(Number(motes) / 1e9).toLocaleString("en-US");

/**
 * The hero's proof: the owner's live spending rules, and a button that asks the
 * contract to break one of them. The refusal is a real transaction — that is the
 * whole argument of the product, made in the first screen instead of described.
 */
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
        /* card degrades to its labels */
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
        setReason(d.error ?? "attempt failed");
        return;
      }
      setTxHash(d.txHash);
      setPhase("pending");

      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const s = await fetch(`/api/tx/status?hash=${d.txHash}`, { cache: "no-store" }).then((r) => r.json());
        if (!s.executed) continue;
        if (s.success) {
          setPhase("settled");
        } else {
          const code = String(s.error ?? "").match(/User error: (\d+)/)?.[1];
          setReason((code && REVERT_MEANING[code]) || s.error);
          setPhase("reverted");
        }
        return;
      }
      setPhase("error");
      setReason("still pending — open it on the explorer");
    } catch (e) {
      setPhase("error");
      setReason(e instanceof Error ? e.message : "attempt failed");
    }
  }

  const running = phase === "sending" || phase === "pending";

  return (
    <div className="glass-panel relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-7 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#8E8E93]">
          The envelope
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-accent-red">
          casper-test
        </span>
      </div>

      {/* The owner's rules, read from the contract */}
      <dl className="grid grid-cols-3 gap-4 py-6">
        {[
          { k: "Per task", v: env ? `${agt(env.perTaskLimit)} AGT` : "—" },
          { k: "Per day", v: env ? `${agt(env.dailyLimit)} AGT` : "—" },
          { k: "Min. trust", v: env ? `${env.minReputation} bps` : "—" },
        ].map((r) => (
          <div key={r.k} className="flex flex-col gap-1">
            <dt className="font-mono text-[9px] uppercase tracking-widest text-[#8E8E93]">{r.k}</dt>
            <dd className="font-sans text-xl md:text-2xl font-black tabular-nums text-white">{r.v}</dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center justify-between rounded-lg border border-white/10 bg-black/40 px-4 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">Brake</span>
        <span
          className={`font-mono text-[10px] font-bold uppercase tracking-widest ${
            env?.paused ? "text-accent-red" : "text-green-400"
          }`}
        >
          {env ? (env.paused ? "◼ halted" : "● spending allowed") : "—"}
        </span>
      </div>

      {/* The proof */}
      <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5">
        <p className="font-sans text-sm text-[#8E8E93] leading-relaxed">
          Agent&nbsp;#{unprovenAgentId} has never been paid — nothing earned, nothing proven. Ask the
          treasury to pay it anyway.
        </p>

        <button
          onClick={attempt}
          disabled={running || !env}
          className="inline-flex items-center justify-center gap-2.5 rounded-full bg-accent-red px-6 py-3 font-mono text-xs font-semibold uppercase tracking-widest text-white shadow-lg shadow-accent-red/20 transition-all duration-300 hover:bg-white hover:text-black disabled:opacity-50"
        >
          <span className={`h-1.5 w-1.5 rounded-full bg-current ${running ? "animate-ping" : ""}`} />
          {phase === "sending"
            ? "Signing…"
            : phase === "pending"
              ? "On-chain…"
              : "Try to pay an unproven agent"}
        </button>

        {phase !== "idle" && (
          <div className="font-mono text-[11px] leading-relaxed">
            {phase === "pending" && <span className="text-[#8E8E93]">submitted — waiting for the chain…</span>}
            {phase === "reverted" && (
              <span className="text-accent-red font-bold">✕ Refused by the contract — {reason}</span>
            )}
            {phase === "settled" && (
              <span className="text-green-400 font-bold">✓ Settled — this one cleared the bar</span>
            )}
            {phase === "error" && <span className="text-[#8E8E93]">{reason}</span>}
            {txHash && (
              <a
                href={`https://testnet.cspr.live/transaction/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block break-all text-[#8E8E93] underline decoration-white/20 transition-colors hover:text-white"
              >
                {txHash.slice(0, 18)}… — read it on cspr.live ↗
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
