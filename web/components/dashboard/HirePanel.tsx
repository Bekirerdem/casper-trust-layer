"use client";

import { useEffect, useMemo, useState } from "react";
import { claimFaucet, hireAgent, type HirePhase } from "@/lib/wallet/hireAgent";
import type { AgentSnapshot } from "@/lib/casper/types";

const JOB_AMOUNT_MOTES = "1000000"; // 0.001 AGT (9 decimals) — same as the live demo jobs
const explorer = (h: string) => `https://testnet.cspr.live/transaction/${h}`;

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
}: {
  publicKey: string;
  agents: AgentSnapshot[];
}) {
  const [myAgentIds, setMyAgentIds] = useState<number[] | null>(null);
  const [providerId, setProviderId] = useState<number | null>(null);
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

  const myAgentId = myAgentIds?.[0];
  const providers = useMemo(
    () => agents.filter((a) => a.agentId !== myAgentId),
    [agents, myAgentId],
  );
  const provider = providers.find((a) => a.agentId === providerId) ?? providers[0];

  async function onFaucet() {
    setFaucetState("pending");
    setFaucetMsg(null);
    try {
      const { txHash } = await claimFaucet(publicKey);
      setFaucetState("done");
      setFaucetMsg(txHash);
    } catch (e) {
      setFaucetState("error");
      setFaucetMsg(e instanceof Error ? e.message : "faucet failed");
    }
  }

  async function onHire() {
    if (myAgentId === undefined || !provider) return;
    setPhase("approve");
    setTxs({});
    setError(null);
    setResult({ before: provider });
    try {
      await hireAgent({
        publicKeyHex: publicKey,
        clientId: myAgentId,
        providerId: provider.agentId,
        amountMotes: JOB_AMOUNT_MOTES,
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
        <span className="font-mono text-[10px] text-green-400">● cüzdan bağlı</span>
      </div>

      <p className="font-sans text-sm text-[#8E8E93] mb-5 leading-relaxed max-w-[68ch]">
        Kendi agent&apos;ınla registry&apos;den bir agent kirala: fonlar escrow&apos;da kilitlenir, kiralanan
        agent işi teslim eder, sen onaylarsın — ödeme settle olur ve provider&apos;ın itibarı{" "}
        <span className="text-white">zincir üstünde, senin işlemlerinle</span> değişir.
      </p>

      {myAgentIds === null && (
        <p className="font-mono text-xs text-[#8E8E93]">Registry taranıyor — agent&apos;ın aranıyor…</p>
      )}

      {myAgentIds !== null && myAgentId === undefined && (
        <p className="font-mono text-xs text-[#8E8E93]">
          Bu cüzdana kayıtlı agent yok — önce aşağıdan <span className="text-white">register</span> ol,
          sonra kiralama burada açılır.
        </p>
      )}

      {myAgentId !== undefined && (
        <div className="flex flex-col gap-5">
          {/* Setup row */}
          <div className="flex flex-col md:flex-row gap-4 md:items-end">
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">Your agent</span>
              <span className="rounded-lg border border-white/15 bg-black/40 px-4 py-2.5 font-mono text-sm text-white">
                Agent #{myAgentId}
              </span>
            </div>
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
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">Job amount</span>
              <span className="rounded-lg border border-white/15 bg-black/40 px-4 py-2.5 font-mono text-sm text-white">
                0.001 AGT
              </span>
            </div>
          </div>

          {/* Faucet + hire actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={onFaucet}
              disabled={faucetState === "pending" || running}
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 font-mono text-xs uppercase tracking-widest text-white transition-all duration-300 hover:border-white/40 hover:bg-white/10 disabled:opacity-50"
            >
              <span className={`h-1.5 w-1.5 rounded-full bg-green-400 ${faucetState === "pending" ? "animate-ping" : ""}`} />
              {faucetState === "pending" ? "Gönderiliyor…" : faucetState === "done" ? "✓ AGT alındı" : "1 · Get test AGT"}
            </button>
            <button
              onClick={onHire}
              disabled={running || !provider}
              className="inline-flex items-center gap-2 rounded-lg bg-accent-red px-6 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-white transition-all duration-300 hover:bg-white hover:text-black disabled:opacity-50"
            >
              <span className={`h-1.5 w-1.5 rounded-full bg-white ${running ? "animate-ping" : ""}`} />
              {running ? "Akış sürüyor — cüzdanı izle…" : `2 · Hire Agent #${provider?.agentId ?? "…"}`}
            </button>
          </div>

          {faucetState === "done" && faucetMsg && (
            <a href={explorer(faucetMsg)} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-green-400 hover:text-white transition-colors -mt-2">
              faucet zincirde — {faucetMsg.slice(0, 12)}… ↗
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
              <span className="text-green-400 font-bold">Settlement zincirde.</span>{" "}
              <span className="text-white">
                Agent #{result.before.agentId}: {result.before.scoreBps} bps
                {result.after ? ` → ${result.after.scoreBps} bps` : ""} · jobs{" "}
                {result.before.jobsCompleted}
                {result.after ? ` → ${result.after.jobsCompleted}` : ""}
              </span>
              <p className="text-[#8E8E93] text-xs mt-1">
                İtibar senin ödediğin, senin onayladığın gerçek bir işten türedi — self-report yok.
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
