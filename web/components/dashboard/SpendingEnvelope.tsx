"use client";

import { useState } from "react";
import type { AgentSnapshot } from "@/lib/casper/types";

export type Envelope = {
  perTaskLimit: string;
  dailyLimit: string;
  minReputation: number;
  locked: string;
  paused: boolean;
  package: string;
};

type Verdict = {
  state: "sending" | "pending" | "sent" | "blocked" | "error";
  txHash?: string;
  message?: string;
};

/** Contract error codes, translated into the account owner's language. */
const BLOCKED_BECAUSE: Record<string, string> = {
  "3": "the amount was zero",
  "4": "this vendor isn't on your approved list",
  "5": "this vendor has no completed jobs yet",
  "6": "it's more than one job is allowed to cost",
  "7": "it's more than today's total allows",
  "8": "there isn't enough left in the account",
  "12": "you've frozen spending",
};

const money = (raw: string) => {
  const n = Number(raw) / 1e9;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 2 : 0 })}`;
};
const receipt = (h: string) => `https://testnet.cspr.live/transaction/${h}`;

function Attempt({
  title,
  subtitle,
  tone,
  buttonLabel,
  disabled,
  onRun,
  verdict,
}: {
  title: string;
  subtitle: string;
  tone: "pass" | "fail";
  buttonLabel: string;
  disabled: boolean;
  onRun: () => void;
  verdict?: Verdict;
}) {
  const running = verdict?.state === "sending" || verdict?.state === "pending";
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-5 ${
        tone === "pass" ? "border-green-500/20 bg-green-500/[0.03]" : "border-accent-red/20 bg-accent-red/[0.03]"
      }`}
    >
      <div className="flex flex-col gap-1.5">
        <span className="font-sans text-sm font-bold text-white">{title}</span>
        <span className="font-sans text-xs leading-relaxed text-[#8E8E93]">{subtitle}</span>
      </div>

      <button
        onClick={onRun}
        disabled={disabled || running}
        className="inline-flex items-center gap-2 self-start rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 font-sans text-xs font-semibold text-white transition-all duration-300 hover:border-white/40 hover:bg-white/10 disabled:opacity-40"
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${tone === "pass" ? "bg-green-400" : "bg-accent-red"} ${running ? "animate-ping" : ""}`}
        />
        {running ? "Checking…" : buttonLabel}
      </button>

      {verdict && verdict.state !== "sending" && (
        <div className="flex flex-col gap-1 font-sans text-xs">
          {verdict.state === "pending" && <span className="text-[#8E8E93]">Checking your rules…</span>}
          {verdict.state === "sent" && (
            <span className="font-semibold text-green-400">Sent — this one cleared your rules.</span>
          )}
          {verdict.state === "blocked" && (
            <span className="font-semibold text-accent-red">
              Blocked — {verdict.message}. Your money didn&apos;t move.
            </span>
          )}
          {verdict.state === "error" && <span className="text-[#8E8E93]">{verdict.message}</span>}
          {verdict.txHash && (
            <a
              href={receipt(verdict.txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#8E8E93] underline decoration-white/20 transition-colors hover:text-white"
            >
              See the receipt ↗
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export function SpendingEnvelope({
  agents,
  env,
}: {
  agents: AgentSnapshot[];
  /** Read once by the console so the vendor list can use the same rule. */
  env: Envelope | null;
}) {
  const [verdicts, setVerdicts] = useState<Record<string, Verdict>>({});

  const trusted = [...agents].sort((a, b) => b.scoreBps - a.scoreBps)[0];
  const unknown = agents.find((a) => a.scoreBps === 0);
  const perJob = env ? Number(env.perTaskLimit) / 1e9 : 100;

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

      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const s = await fetch(`/api/tx/status?hash=${d.txHash}`, { cache: "no-store" }).then((r) => r.json());
        if (!s.executed) continue;
        if (s.success) {
          setVerdicts((v) => ({ ...v, [key]: { state: "sent", txHash: d.txHash } }));
        } else {
          const code = String(s.error ?? "").match(/User error: (\d+)/)?.[1];
          setVerdicts((v) => ({
            ...v,
            [key]: {
              state: "blocked",
              txHash: d.txHash,
              message: (code && BLOCKED_BECAUSE[code]) || "your rules didn't allow it",
            },
          }));
        }
        return;
      }
      setVerdicts((v) => ({
        ...v,
        [key]: { state: "error", message: "Still processing — check the receipt.", txHash: d.txHash },
      }));
    } catch (e) {
      setVerdicts((v) => ({
        ...v,
        [key]: { state: "error", message: e instanceof Error ? e.message : "Something went wrong." },
      }));
    }
  }

  return (
    <section className="glass-panel bg-white/5 border-accent-red/20 rounded-2xl p-6 md:p-8 mt-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="font-sans text-lg font-bold text-white">Spending limits</h2>
        <span className="font-sans text-xs text-[#8E8E93]">Demo account · test funds</span>
      </div>

      <p className="font-sans text-sm text-[#8E8E93] mb-6 leading-relaxed max-w-[68ch]">
        You decide what your agent can spend and who it may pay. The account holds those rules
        itself, so the agent cannot talk its way past them — and neither can we.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { v: env ? money(env.perTaskLimit) : "—", l: "Per job" },
          { v: env ? money(env.dailyLimit) : "—", l: "Per day" },
          { v: "Completed jobs", l: "Vendors must have" },
          { v: env ? money(env.locked) : "—", l: "Set aside" },
        ].map((s) => (
          <div key={s.l} className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="font-sans text-xl font-black tabular-nums text-white">{s.v}</div>
            <div className="font-sans text-xs text-[#8E8E93] mt-1">{s.l}</div>
          </div>
        ))}
      </div>

      {/* Freeze */}
      <div
        className={`rounded-xl border p-4 mb-7 ${
          env?.paused ? "border-accent-red/40 bg-accent-red/5" : "border-white/10 bg-black/30"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-sans text-sm font-semibold text-white">Freeze</span>
          <span
            className={`font-sans text-xs font-semibold ${env?.paused ? "text-accent-red" : "text-green-400"}`}
          >
            {env ? (env.paused ? "Frozen — nothing can be paid" : "Active — spending allowed") : "—"}
          </span>
        </div>
        <p className="font-sans text-xs text-[#8E8E93] mt-2 leading-relaxed">
          One switch stops every payment instantly. Nothing leaves the account and nothing has to be
          undone.{" "}
          <a
            href={receipt("c96cf67dabaeb2eb3462278fc2ccc60cd6a14aa604be0dc2775bccf108ffdff8")}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline decoration-white/20 transition-colors hover:text-accent-red"
          >
            See a payment refused while frozen ↗
          </a>
        </p>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="font-sans text-sm font-bold text-white">Try to break the rules</h3>
        <span className="font-sans text-xs text-[#8E8E93]">No wallet needed</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {trusted && (
          <Attempt
            title="A vendor with history"
            subtitle={`This one has finished ${trusted.jobsCompleted} paid ${trusted.jobsCompleted === 1 ? "job" : "jobs"} for other customers.`}
            tone="pass"
            buttonLabel="Send $1"
            disabled={!env}
            onRun={() => attempt("trusted", trusted.agentId, "1")}
            verdict={verdicts.trusted}
          />
        )}
        {unknown && (
          <Attempt
            title="A vendor with none"
            subtitle="Nobody has ever paid this one. It has no finished work behind it."
            tone="fail"
            buttonLabel="Send $1 anyway"
            disabled={!env}
            onRun={() => attempt("unknown", unknown.agentId, "1")}
            verdict={verdicts.unknown}
          />
        )}
        {trusted && env && (
          <Attempt
            title="More than one job allows"
            subtitle={`Same trusted vendor, but your limit is ${money(env.perTaskLimit)} for a single job.`}
            tone="fail"
            buttonLabel={`Send $${Math.round(perJob) + 50}`}
            disabled={!env}
            onRun={() => attempt("overcap", trusted.agentId, String(Math.round(perJob) + 50))}
            verdict={verdicts.overcap}
          />
        )}
      </div>

      <p className="font-sans text-xs text-[#8E8E93] mt-5 leading-relaxed">
        Every attempt is real. A refusal is recorded the same way a payment is, which is why you can
        open its receipt instead of taking our word for it.
      </p>
    </section>
  );
}
