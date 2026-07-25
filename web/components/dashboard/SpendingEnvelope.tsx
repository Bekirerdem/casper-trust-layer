"use client";

import { useEffect, useState } from "react";
import type { AgentSnapshot } from "@/lib/casper/types";

type Envelope = {
  perTaskLimit: string;
  dailyLimit: string;
  minReputation: number;
  locked: string;
  package: string;
};

type Verdict = {
  state: "sending" | "pending" | "settled" | "reverted" | "error";
  txHash?: string;
  message?: string;
};

/** AgentTreasury error codes — contracts/src/treasury.rs. */
const REVERT_MEANING: Record<string, string> = {
  "3": "amount was zero",
  "4": "payee is not whitelisted and no reputation policy is active",
  "5": "payee's earned score is below the owner's bar",
  "6": "amount exceeds the per-task cap",
  "7": "amount exceeds the daily cap",
  "8": "treasury has no unlocked funds left",
};

const agt = (motes: string) => (Number(motes) / 1e9).toLocaleString("en-US", { maximumFractionDigits: 3 });
const tx = (h: string) => `https://testnet.cspr.live/transaction/${h}`;

function Scenario({
  title,
  subtitle,
  tone,
  amount,
  payee,
  disabled,
  onRun,
  verdict,
}: {
  title: string;
  subtitle: string;
  tone: "pass" | "fail";
  amount: string;
  payee: number;
  disabled: boolean;
  onRun: () => void;
  verdict?: Verdict;
}) {
  const running = verdict?.state === "sending" || verdict?.state === "pending";
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 ${
        tone === "pass" ? "border-green-500/20 bg-green-500/[0.03]" : "border-accent-red/20 bg-accent-red/[0.03]"
      }`}
    >
      <div className="flex flex-col gap-1">
        <span className="font-mono text-xs font-bold text-white">{title}</span>
        <span className="font-mono text-[10px] text-[#8E8E93] leading-relaxed">{subtitle}</span>
      </div>

      <button
        onClick={onRun}
        disabled={disabled || running}
        className="inline-flex items-center gap-2 self-start rounded-lg border border-white/15 bg-white/5 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white transition-all duration-300 hover:border-white/40 hover:bg-white/10 disabled:opacity-40"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${tone === "pass" ? "bg-green-400" : "bg-accent-red"} ${running ? "animate-ping" : ""}`} />
        {running ? "On-chain…" : `Pay ${amount} AGT to #${payee}`}
      </button>

      {verdict && verdict.state !== "sending" && (
        <div className="flex flex-col gap-1 font-mono text-[10px]">
          {verdict.state === "pending" && <span className="text-[#8E8E93]">submitted — waiting for finality…</span>}
          {verdict.state === "settled" && <span className="text-green-400 font-bold">✓ SETTLED — funds left the envelope</span>}
          {verdict.state === "reverted" && (
            <span className="text-accent-red font-bold">✕ REVERTED — {verdict.message}</span>
          )}
          {verdict.state === "error" && <span className="text-[#8E8E93]">{verdict.message}</span>}
          {verdict.txHash && (
            <a href={tx(verdict.txHash)} target="_blank" rel="noopener noreferrer" className="text-[#8E8E93] hover:text-white transition-colors break-all">
              {verdict.txHash.slice(0, 16)}… ↗ verify on cspr.live
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function SpendingEnvelope({ agents }: { agents: AgentSnapshot[] }) {
  const [env, setEnv] = useState<Envelope | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/treasury", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Envelope | null) => {
        if (!cancelled && d && !("error" in d)) setEnv(d);
      })
      .catch(() => {
        /* the block simply stays minimal */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Pick a real proven counterparty and a real unproven one from live scores.
  const proven = [...agents].sort((a, b) => b.scoreBps - a.scoreBps)[0];
  const unproven = agents.find((a) => a.scoreBps === 0);
  const bar = env?.minReputation ?? 1;

  async function attempt(key: string, payee: number, amountAgt: string) {
    setVerdicts((v) => ({ ...v, [key]: { state: "sending" } }));
    try {
      const res = await fetch("/api/treasury/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payee, amountAgt }),
      });
      const d = await res.json();
      if (!res.ok) {
        setVerdicts((v) => ({ ...v, [key]: { state: "error", message: d.error } }));
        return;
      }
      setVerdicts((v) => ({ ...v, [key]: { state: "pending", txHash: d.txHash } }));

      // Poll until the chain reports a verdict.
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const s = await fetch(`/api/tx/status?hash=${d.txHash}`, { cache: "no-store" }).then((r) => r.json());
        if (!s.executed) continue;
        if (s.success) {
          setVerdicts((v) => ({ ...v, [key]: { state: "settled", txHash: d.txHash } }));
        } else {
          const code = String(s.error ?? "").match(/User error: (\d+)/)?.[1];
          setVerdicts((v) => ({
            ...v,
            [key]: { state: "reverted", txHash: d.txHash, message: (code && REVERT_MEANING[code]) || s.error },
          }));
        }
        return;
      }
      setVerdicts((v) => ({ ...v, [key]: { state: "error", message: "still pending — check the explorer", txHash: d.txHash } }));
    } catch (e) {
      setVerdicts((v) => ({ ...v, [key]: { state: "error", message: e instanceof Error ? e.message : "attempt failed" } }));
    }
  }

  return (
    <section className="glass-panel bg-white/5 border-accent-red/20 rounded-2xl p-6 md:p-8 mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-accent-red">
          The envelope · what your agent may spend
        </h2>
        <span className="font-mono text-[10px] text-[#8E8E93]">enforced in AgentTreasury, not the SDK</span>
      </div>

      <p className="font-sans text-sm text-[#8E8E93] mb-6 leading-relaxed max-w-[70ch]">
        An owner funds this treasury and delegates spending to an agent. The contract holds the
        rules: a per-task ceiling, a daily ceiling, and a counterparty bar. The agent cannot argue
        its way past any of them — and neither can we.
      </p>

      {/* The rules, live from chain */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { v: env ? `${agt(env.perTaskLimit)} AGT` : "—", l: "Per-task cap" },
          { v: env ? `${agt(env.dailyLimit)} AGT` : "—", l: "Daily cap" },
          { v: env ? `${bar} bps` : "—", l: "Counterparty bar" },
          { v: env ? `${agt(env.locked)} AGT` : "—", l: "Locked in reservations" },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="font-mono text-xl font-black tabular-nums text-white">{s.v}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93] mt-1">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-4 mb-6">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93] block mb-1.5">
          Counterparty rule
        </span>
        <p className="font-mono text-xs text-white">
          Pay anyone <span className="text-[#8E8E93]">whitelisted</span>{" "}
          <span className="text-accent-red">OR</span> proven{" "}
          <span className="text-green-400">≥ {bar} bps</span> of earned, settlement-backed trust.
        </p>
      </div>

      {/* THE TEST */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-white">
          Try to spend · the contract decides, live
        </h3>
        <span className="font-mono text-[10px] text-[#8E8E93]">no wallet needed</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {proven && (
          <Scenario
            title="Proven counterparty"
            subtitle={`Agent #${proven.agentId} earned ${proven.scoreBps} bps over ${proven.jobsCompleted} settled jobs — clears the bar.`}
            tone="pass"
            amount="0.001"
            payee={proven.agentId}
            disabled={!env}
            onRun={() => attempt("proven", proven.agentId, "0.001")}
            verdict={verdicts.proven}
          />
        )}
        {unproven && (
          <Scenario
            title="Unproven counterparty"
            subtitle={`Agent #${unproven.agentId} has never been paid — 0 bps, below the bar and not whitelisted.`}
            tone="fail"
            amount="0.001"
            payee={unproven.agentId}
            disabled={!env}
            onRun={() => attempt("unproven", unproven.agentId, "0.001")}
            verdict={verdicts.unproven}
          />
        )}
        {proven && env && (
          <Scenario
            title="Over the per-task cap"
            subtitle={`Same trusted counterparty, but ${agt(env.perTaskLimit)} AGT is the ceiling for one task.`}
            tone="fail"
            amount={String(Number(agt(env.perTaskLimit)) + 50)}
            payee={proven.agentId}
            disabled={!env}
            onRun={() => attempt("overcap", proven.agentId, String(Number(agt(env.perTaskLimit)) + 50))}
            verdict={verdicts.overcap}
          />
        )}
      </div>

      <p className="font-mono text-[10px] text-[#8E8E93] mt-4 leading-relaxed">
        Every attempt is a real transaction on casper-test — a rejection costs gas and is written to
        the chain, which is what makes it evidence rather than a claim.
      </p>
    </section>
  );
}
