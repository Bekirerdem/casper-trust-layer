"use client";

import { useEffect, useMemo, useState } from "react";
import { claimFaucet, hireAgent, type HirePhase } from "@/lib/wallet/hireAgent";
import type { AgentSnapshot } from "@/lib/casper/types";

const explorer = (h: string) => `https://testnet.cspr.live/transaction/${h}`;

/** AGT has 9 decimals; the faucet grants 0.01 AGT. */
function agtToMotes(agt: string): string | null {
  const n = Number(agt);
  if (!Number.isFinite(n) || n <= 0) return null;
  return String(Math.round(n * 1_000_000_000));
}

type Phase = "idle" | HirePhase | "done" | "error";

const STEPS: { key: HirePhase; label: string; signer: "you" | "agent" }[] = [
  { key: "approve", label: "Allow escrow to spend AGT", signer: "you" },
  { key: "create_job", label: "Create job — funds lock in escrow", signer: "you" },
  { key: "work", label: "Hired agent delivers the work", signer: "agent" },
  { key: "approve_job", label: "Release — settlement + reputation", signer: "you" },
];

export function HirePanel({
  publicKey,
  agents,
  onSettled,
}: {
  publicKey: string;
  agents: AgentSnapshot[];
  onSettled?: (providerId: number, rep: { scoreBps: number; jobsCompleted: number }) => void;
}) {
  const [myAgentIds, setMyAgentIds] = useState<number[] | null>(null);
  const [clientId, setClientId] = useState<number | null>(null);
  const [providerId, setProviderId] = useState<number | null>(null);
  const [amountAgt, setAmountAgt] = useState("0.001");
  const [phase, setPhase] = useState<Phase>("idle");
  const [txs, setTxs] = useState<Partial<Record<HirePhase, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [faucetState, setFaucetState] = useState<"idle" | "pending" | "done" | "error">("idle");
  const [faucetMsg, setFaucetMsg] = useState<string | null>(null);
  const [result, setResult] = useState<{ before: AgentSnapshot; after?: { scoreBps: number; jobsCompleted: number } } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMyAgentIds(null);
    fetch(`/api/agents/mine?publicKey=${publicKey}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !cancelled && setMyAgentIds(d.agentIds ?? []))
      .catch(() => !cancelled && setMyAgentIds([]));
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  const myAgentId = clientId ?? myAgentIds?.[0];
  const providers = useMemo(
    () => agents.filter((a) => a.agentId !== myAgentId),
    [agents, myAgentId],
  );
  const provider = providers.find((a) => a.agentId === providerId) ?? providers[0];
  const amountMotes = agtToMotes(amountAgt);

  async function onFaucet() {
    setFaucetState("pending");
    setFaucetMsg(null);
    try {
      const res = await claimFaucet(publicKey);
      setFaucetState("done");
      setFaucetMsg(res.skipped ? null : (res.txHash ?? null));
    } catch (e) {
      setFaucetState("error");
      setFaucetMsg(e instanceof Error ? e.message : "faucet failed");
    }
  }

  async function onHire() {
    if (myAgentId === undefined || !provider || !amountMotes) return;
    setPhase("approve");
    setTxs({});
    setError(null);
    setResult({ before: provider });
    try {
      await hireAgent({
        publicKeyHex: publicKey,
        clientId: myAgentId,
        providerId: provider.agentId,
        amountMotes,
        onPhase: (p, txHash) => {
          setPhase(p);
          if (txHash) setTxs((t) => ({ ...t, [p]: txHash }));
        },
      });
      // Read the provider's post-settlement reputation live from chain.
      try {
        const res = await fetch(`/api/trust/${provider.agentId}`, { cache: "no-store" });
        if (res.ok) {
          const d = (await res.json()) as { scoreBps: number; jobsCompleted: number };
          setResult((r) => (r ? { ...r, after: d } : r));
          onSettled?.(provider.agentId, { scoreBps: d.scoreBps, jobsCompleted: d.jobsCompleted });
        }
      } catch {
        /* result panel falls back to tx links */
      }
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "hire failed");
      setPhase("error");
    }
  }

  const running = phase !== "idle" && phase !== "done" && phase !== "error";
  const stepIndex = STEPS.findIndex((s) => s.key === phase);

  return (
    <section className="glass-panel bg-white/5 border-accent-red/20 rounded-2xl p-6 md:p-8 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-accent-red">
          Hire an agent · live escrow → settlement → reputation
        </h2>
        <span className="font-mono text-[10px] text-green-400">● wallet connected</span>
      </div>

      <p className="font-sans text-sm text-[#8E8E93] mb-5 leading-relaxed max-w-[68ch]">
        Hire an agent from the registry with your own agent: funds lock in escrow, the hired
        agent delivers, you approve — payment settles and the provider&apos;s reputation changes{" "}
        <span className="text-white">on-chain, from your own transactions</span>.
      </p>

      {myAgentIds === null && (
        <p className="font-mono text-xs text-[#8E8E93]">Scanning the registry for your agent…</p>
      )}

      {myAgentIds !== null && myAgentId === undefined && (
        <p className="font-mono text-xs text-[#8E8E93]">
          No agent is registered to this wallet — <span className="text-white">register</span> below
          first, and hiring unlocks here.
        </p>
      )}

      {myAgentId !== undefined && (
        <div className="flex flex-col gap-5">
          {/* Setup row — every field is a real input */}
          <div className="flex flex-col md:flex-row gap-4 md:items-end">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">Your agent (client)</span>
              <select
                value={myAgentId ?? ""}
                onChange={(e) => setClientId(Number(e.target.value))}
                disabled={running}
                className="rounded-lg border border-white/15 bg-black/40 px-4 py-2.5 font-mono text-sm text-white focus:border-accent-red/50 focus:outline-none"
              >
                {(myAgentIds ?? []).map((id) => (
                  <option key={id} value={id}>
                    Agent #{id}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 flex-1 max-w-xs">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">Hire (provider)</span>
              <select
                value={provider?.agentId ?? ""}
                onChange={(e) => setProviderId(Number(e.target.value))}
                disabled={running}
                className="rounded-lg border border-white/15 bg-black/40 px-4 py-2.5 font-mono text-sm text-white focus:border-accent-red/50 focus:outline-none"
              >
                {providers.map((a) => (
                  <option key={a.agentId} value={a.agentId}>
                    Agent #{a.agentId} — {a.scoreBps} bps · {a.jobsCompleted} jobs
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">Job amount (AGT)</span>
              <input
                value={amountAgt}
                onChange={(e) => setAmountAgt(e.target.value)}
                disabled={running}
                inputMode="decimal"
                className={`w-32 rounded-lg border bg-black/40 px-4 py-2.5 font-mono text-sm text-white focus:outline-none ${
                  amountMotes ? "border-white/15 focus:border-accent-red/50" : "border-accent-red/60"
                }`}
                placeholder="0.001"
              />
            </label>
          </div>
          {!amountMotes && (
            <p className="font-mono text-xs text-accent-red -mt-2">Enter a positive AGT amount (the faucet grants 0.01).</p>
          )}

          {/* Faucet + hire actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onFaucet}
              disabled={faucetState === "pending" || running}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 font-mono text-xs uppercase tracking-widest text-white transition-all duration-300 hover:border-white/40 hover:bg-white/10 disabled:opacity-50"
            >
              <span className={`h-1.5 w-1.5 rounded-full bg-green-400 ${faucetState === "pending" ? "animate-ping" : ""}`} />
              {faucetState === "pending" ? "Sending…" : faucetState === "done" ? "✓ AGT ready" : "1 · Get test AGT"}
            </button>
            <button
              onClick={onHire}
              disabled={running || !provider || !amountMotes}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-red px-6 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-white transition-all duration-300 hover:bg-white hover:text-black disabled:opacity-50"
            >
              <span className={`h-1.5 w-1.5 rounded-full bg-white ${running ? "animate-ping" : ""}`} />
              {running ? "Flow running — watch your wallet…" : `2 · Hire Agent #${provider?.agentId ?? "…"}`}
            </button>
          </div>

          {faucetState === "done" && faucetMsg && (
            <a href={explorer(faucetMsg)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-green-400 hover:text-white transition-colors -mt-2">
              faucet on-chain — {faucetMsg.slice(0, 12)}… ↗
            </a>
          )}
          {faucetState === "error" && faucetMsg && (
            <p className="font-mono text-xs text-accent-red -mt-2 break-all">✕ {faucetMsg}</p>
          )}

          {/* Step tracker */}
          {phase !== "idle" && (
            <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/30 p-4">
              {STEPS.map((s, i) => {
                const st =
                  phase === "done" || (stepIndex >= 0 && i < stepIndex) || txs[s.key]
                    ? "done"
                    : s.key === phase
                      ? "active"
                      : "todo";
                const tx = txs[s.key];
                return (
                  <div key={s.key} className="flex items-center gap-3 font-mono text-xs">
                    <span
                      className={
                        st === "done"
                          ? "text-green-400"
                          : st === "active"
                            ? "text-accent-red animate-pulse"
                            : "text-[#8E8E93]"
                      }
                    >
                      {st === "done" ? "✓" : st === "active" ? "●" : "○"}
                    </span>
                    <span className={st === "todo" ? "text-[#8E8E93]" : "text-white"}>{s.label}</span>
                    <span className="text-[9px] uppercase tracking-widest text-[#8E8E93]">
                      {s.signer === "you" ? "you sign" : "agent signs"}
                    </span>
                    {tx && (
                      <a href={explorer(tx)} target="_blank" rel="noopener noreferrer" className="ml-auto text-green-400 hover:text-white transition-colors">
                        {tx.slice(0, 10)}… ↗
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Result */}
          {phase === "done" && result && (
            <div className="rounded-xl border border-green-400/20 bg-green-400/5 p-4 font-mono text-sm">
              <span className="text-green-400 font-bold">Settlement on-chain.</span>{" "}
              <span className="text-white">
                Agent #{result.before.agentId}: {result.before.scoreBps} bps
                {result.after ? ` → ${result.after.scoreBps} bps` : ""} · jobs{" "}
                {result.before.jobsCompleted}
                {result.after ? ` → ${result.after.jobsCompleted}` : ""}
              </span>
              <p className="text-[#8E8E93] text-xs mt-1">
                This reputation came from real work you paid for and approved — no self-reports.
              </p>
            </div>
          )}
          {phase === "error" && error && (
            <p className="font-mono text-xs text-accent-red break-all">✕ {error}</p>
          )}
        </div>
      )}
    </section>
  );
}
