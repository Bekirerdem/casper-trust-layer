"use client";

import { useMemo, useState } from "react";
import { loadSnapshot } from "@/lib/data/snapshot";
import { WalletButton } from "@/components/dashboard/WalletButton";
import type { AgentSnapshot, SettlementProof } from "@/lib/casper/types";

const SCORE_MAX = 500;

const CONTRACTS = [
  { name: "IdentityRegistry", pkg: "3a51cc5f4c524f806b3b8899039030bbad141005f81ab99895615d8f050c7adc" },
  { name: "ReputationEngine", pkg: "d73fb11144c07ec05071cf986ad65b407f2da91bd871b0c10f67a974832ee7eb" },
  { name: "Escrow", pkg: "fe6b0ddb307549cc9101659abcfaf114e37a8d99461c0632cbce582ebdc4902c" },
  { name: "AgentTreasury", pkg: "abbdbdfd40fc241983efda0d42efabdc2b919d6b94fe1e2849e98d6e640e763c" },
  { name: "Cep18 (AGT)", pkg: "f962076e6c2ba423aaade9f75935ff37ef4aa4cde6077bac9a259af141c3d5c6" },
];

function short(h: string): string {
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

function RegistryItem({
  agent,
  selected,
  onSelect,
}: {
  agent: AgentSnapshot;
  selected: boolean;
  onSelect: () => void;
}) {
  const pct = Math.min(100, (agent.scoreBps / SCORE_MAX) * 100);
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border p-4 transition-all duration-300 ${
        selected
          ? "border-accent-red/40 bg-accent-red/5"
          : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-bold text-white">Agent #{agent.agentId}</span>
        <span className="font-mono text-lg font-black tabular-nums text-white">
          {agent.scoreBps}
          <span className="text-[10px] font-medium text-[#8E8E93] ml-1">bps</span>
        </span>
      </div>
      <div className="mt-3 h-1 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-linear-to-r from-accent-red to-orange-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">
        <span>{agent.jobsCompleted} jobs settled</span>
        <span className={agent.scoreBps > 0 ? "text-green-400" : "text-[#8E8E93]"}>
          {agent.scoreBps > 0 ? "trusted" : "unproven"}
        </span>
      </div>
    </button>
  );
}

function SettlementRow({ s, agentId }: { s: SettlementProof; agentId: number }) {
  const delta = s.scoreAfter - s.scoreBefore;
  const earned = s.to === agentId; // agent was the paid provider
  return (
    <a
      href={`https://testnet.cspr.live/deploy/${s.txHash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 font-mono text-xs transition-colors hover:border-white/15 hover:bg-white/5"
    >
      <span className={`shrink-0 text-[9px] uppercase tracking-widest ${earned ? "text-green-400" : "text-[#8E8E93]"}`}>
        {earned ? `from #${s.from}` : `to #${s.to}`}
      </span>
      <span className="text-white">{short(s.txHash)}</span>
      <span className={`font-bold ${delta > 0 ? "text-green-400" : "text-[#8E8E93]"}`}>
        {delta > 0 ? `+${delta}` : delta} bps
      </span>
      <span className="text-accent-red">↗</span>
    </a>
  );
}

export function TrustDashboard() {
  const snapshot = loadSnapshot();
  const [selectedId, setSelectedId] = useState(0);
  const [live, setLive] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);

  const agents = snapshot.agents;
  const selected = agents.find((a) => a.agentId === selectedId) ?? agents[0];
  const liveScore = live[selectedId];
  const shownScore = liveScore ?? selected.scoreBps;

  const agentSettlements = useMemo(
    () => snapshot.settlements.filter((s) => s.to === selectedId || s.from === selectedId),
    [snapshot.settlements, selectedId],
  );

  async function refreshLive() {
    setLoading(true);
    try {
      const res = await fetch(`/api/trust/${selectedId}`, { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as { scoreBps: number };
        setLive((prev) => ({ ...prev, [selectedId]: d.scoreBps }));
      }
    } catch {
      /* keep snapshot value */
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />
      <div className="relative mx-auto max-w-[1200px] px-6 md:px-10 py-10">
        {/* Top bar */}
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <div className="flex flex-col gap-1">
            <a href="/" className="font-mono text-xs tracking-[0.18em] text-[#8E8E93] uppercase hover:text-white transition-colors">
              ← Casper <span className="text-accent-red">Trust</span> Layer
            </a>
            <h1 className="font-sans text-2xl md:text-3xl font-black tracking-tight text-white">
              Trust Console
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-accent-red border border-accent-red/20 bg-accent-red/5 rounded px-2 py-1">
              {snapshot.network}
            </span>
            <WalletButton />
          </div>
        </header>

        {/* Stat strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { n: agents.length, l: "Agents registered" },
            { n: snapshot.settlements.length, l: "Settlements" },
            { n: Math.max(...agents.map((a) => a.scoreBps)), l: "Top score (bps)" },
            { n: CONTRACTS.length, l: "Live contracts" },
          ].map((s) => (
            <div key={s.l} className="glass-panel bg-white/5 border-white/5 rounded-xl p-4">
              <div className="font-mono text-3xl font-black tabular-nums text-white">{s.n}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93] mt-1">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Registry + detail */}
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.6fr] gap-6 mt-6">
          {/* Registry */}
          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">
              Agent Registry · wallet-free read
            </h2>
            {agents.map((a) => (
              <RegistryItem
                key={a.agentId}
                agent={a}
                selected={a.agentId === selectedId}
                onSelect={() => setSelectedId(a.agentId)}
              />
            ))}
          </section>

          {/* Detail */}
          <section className="glass-panel bg-white/5 border-white/5 rounded-2xl p-6 md:p-8 flex flex-col gap-6">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">
                  Agent #{selected.agentId} · on-chain reputation
                </span>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-6xl font-black tabular-nums text-white">{shownScore}</span>
                  <span className="font-mono text-sm text-green-400 font-bold uppercase">bps</span>
                  {liveScore !== undefined && (
                    <span className="font-mono text-[10px] text-green-400">✓ live</span>
                  )}
                </div>
                <span className="font-mono text-xs text-[#8E8E93]">{selected.jobsCompleted} jobs settled</span>
              </div>
              <button
                onClick={refreshLive}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white transition-all duration-300 hover:border-white/40 hover:bg-white/10 disabled:opacity-50"
              >
                <span className={`h-1.5 w-1.5 rounded-full bg-accent-red ${loading ? "animate-ping" : ""}`} />
                {loading ? "Reading…" : "Read live"}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">
                Settlement history ({agentSettlements.length})
              </span>
              <div className="flex flex-col gap-2">
                {agentSettlements.length > 0 ? (
                  agentSettlements.map((s) => <SettlementRow key={s.txHash} s={s} agentId={selectedId} />)
                ) : (
                  <p className="font-mono text-xs text-[#8E8E93] py-4">
                    No settlements yet — this agent is unproven.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Treasury + contracts */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-6 mt-6">
          <section className="glass-panel bg-white/5 border-white/5 rounded-2xl p-6 md:p-8">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93] mb-4">
              AgentTreasury · bounded spend envelope
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="font-mono text-2xl font-black text-white">100 <span className="text-xs text-[#8E8E93]">AGT</span></div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93] mt-1">Per-task cap</div>
              </div>
              <div>
                <div className="font-mono text-2xl font-black text-white">500 <span className="text-xs text-[#8E8E93]">AGT</span></div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93] mt-1">Daily cap</div>
              </div>
            </div>
            <p className="font-sans text-xs text-[#8E8E93] mt-4 leading-relaxed">
              Funds release only to a payee that is whitelisted <span className="text-white">or</span> clears the on-chain reputation gate — enforced in the contract, not the SDK.
            </p>
          </section>

          <section className="glass-panel bg-white/5 border-white/5 rounded-2xl p-6 md:p-8">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93] mb-4">
              Live contracts · casper-test
            </h2>
            <div className="flex flex-col gap-2">
              {CONTRACTS.map((c) => (
                <a
                  key={c.name}
                  href={`https://testnet.cspr.live/contract-package/${c.pkg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2.5 font-mono text-xs transition-colors hover:border-white/15 hover:bg-white/5"
                >
                  <span className="text-white">{c.name}</span>
                  <span className="text-[#8E8E93]">{c.pkg.slice(0, 8)}… <span className="text-accent-red">↗</span></span>
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
