"use client";

import { useEffect, useMemo, useState } from "react";
import { loadSnapshot } from "@/lib/data/snapshot";
import { WalletButton } from "@/components/dashboard/WalletButton";
import { RegisterPanel } from "@/components/dashboard/RegisterPanel";
import { HirePanel } from "@/components/dashboard/HirePanel";
import { MyAgentPanel } from "@/components/dashboard/MyAgentPanel";
import { SpendingEnvelope, type Envelope } from "@/components/dashboard/SpendingEnvelope";
import { useCasperWallet } from "@/lib/wallet/useCasperWallet";
import type { AgentSnapshot, SettlementProof } from "@/lib/casper/types";

const SCORE_MAX = 500;

type LiveRep = { scoreBps: number; jobsCompleted: number };

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
  live,
  selected,
  mine,
  bar,
  onSelect,
}: {
  agent: AgentSnapshot;
  live?: LiveRep;
  selected: boolean;
  mine?: boolean;
  /** The owner's counterparty threshold, so each row says whether it is payable. */
  bar?: number;
  onSelect: () => void;
}) {
  // Live (post-hire / read-live) values override the build-time snapshot.
  const scoreBps = live?.scoreBps ?? agent.scoreBps;
  const jobsCompleted = live?.jobsCompleted ?? agent.jobsCompleted;
  const pct = Math.min(100, (scoreBps / SCORE_MAX) * 100);
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
        <span className="font-mono text-sm font-bold text-white">
          Agent #{agent.agentId}
          {mine && (
            <span className="ml-2 rounded border border-accent-red/40 bg-accent-red/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-accent-red align-middle">
              yours
            </span>
          )}
        </span>
        <span className="font-mono text-lg font-black tabular-nums text-white">
          {scoreBps}
          <span className="text-[10px] font-medium text-[#8E8E93] ml-1">bps</span>
          {live && <span className="ml-1.5 text-[9px] font-medium text-green-400 align-middle">● live</span>}
        </span>
      </div>
      <div className="mt-3 h-1 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-linear-to-r from-accent-red to-orange-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">
        <span>{jobsCompleted} {jobsCompleted === 1 ? "job" : "jobs"} settled</span>
        {/* Framed as the owner's decision, not an abstract label: can I pay this one? */}
        {bar === undefined ? (
          <span className={scoreBps > 0 ? "text-orange-400" : "text-[#8E8E93]"}>
            {scoreBps > 0 ? "earning" : "unproven"}
          </span>
        ) : (
          <span className={scoreBps >= bar ? "text-green-400" : "text-accent-red"}>
            {scoreBps >= bar ? "✓ payable" : "✕ below your bar"}
          </span>
        )}
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
        {earned ? `earned · from #${s.from}` : `paid → #${s.to}`}
      </span>
      <span className="text-white">{short(s.txHash)}</span>
      {/* An outgoing row's delta belongs to the counterparty — show it neutral, not as a gain */}
      <span className={`font-bold ${earned && delta > 0 ? "text-green-400" : "text-[#8E8E93]"}`}>
        {earned ? `${delta > 0 ? "+" : ""}${delta} bps` : `#${s.to} gains +${delta} bps`}
      </span>
      <span className="text-accent-red">↗</span>
    </a>
  );
}

export function TrustDashboard() {
  const snapshot = loadSnapshot();
  const wallet = useCasperWallet();
  const [selectedId, setSelectedId] = useState(0);
  const [myAgentId, setMyAgentId] = useState<number | null>(null);
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [live, setLive] = useState<Record<number, LiveRep>>({});
  const [extraSettlements, setExtraSettlements] = useState(0);
  const [extraAgents, setExtraAgents] = useState(0);
  const [loading, setLoading] = useState(false);

  const agents = snapshot.agents;
  const selected = agents.find((a) => a.agentId === selectedId) ?? agents[0];
  const liveScore = live[selectedId]?.scoreBps;
  const shownScore = liveScore ?? selected.scoreBps;
  const shownJobs = live[selectedId]?.jobsCompleted ?? selected.jobsCompleted;

  // On load, refresh the whole registry from chain in ONE request (server-cached)
  // so the console never shows a stale snapshot. Failures keep the snapshot.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/trust/all", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { agents?: (LiveRep & { agentId: number })[] }) => {
        if (cancelled || !d.agents) return;
        setLive((prev) => {
          const next = { ...prev };
          for (const a of d.agents!) next[a.agentId] = { scoreBps: a.scoreBps, jobsCompleted: a.jobsCompleted };
          return next;
        });
      })
      .catch(() => {
        /* keep snapshot values */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The owner's rule, read once — the envelope panel and the registry badges
  // must judge every counterparty against the same live threshold.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/treasury", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Envelope | null) => {
        if (!cancelled && d && !("error" in d)) setEnvelope(d);
      })
      .catch(() => {
        /* panel falls back to a minimal state */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // A shared profile link (?agent=N) opens the console focused on that agent.
  useEffect(() => {
    const wanted = Number(new URLSearchParams(window.location.search).get("agent"));
    if (Number.isInteger(wanted) && agents.some((a) => a.agentId === wanted)) {
      setSelectedId(wanted);
    }
  }, [agents]);

  const agentSettlements = useMemo(
    () => snapshot.settlements.filter((s) => s.to === selectedId || s.from === selectedId),
    [snapshot.settlements, selectedId],
  );

  async function refreshLive() {
    setLoading(true);
    try {
      const res = await fetch(`/api/trust/${selectedId}`, { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as LiveRep;
        setLive((prev) => ({ ...prev, [selectedId]: { scoreBps: d.scoreBps, jobsCompleted: d.jobsCompleted } }));
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
            <WalletButton
              connecting={wallet.connecting}
              publicKey={wallet.publicKey}
              error={wallet.error}
              connect={wallet.connect}
              disconnect={wallet.disconnect}
            />
          </div>
        </header>

        {/* Ownership first: a connected wallet should see ITS agent before the network's */}
        {wallet.publicKey && (
          <MyAgentPanel
            publicKey={wallet.publicKey}
            rescanKey={extraAgents}
            onResolved={(id) => {
              setMyAgentId(id);
              setSelectedId(id);
            }}
          />
        )}

        {/* The owner's envelope + the live proof that the contract enforces it */}
        <SpendingEnvelope agents={agents.map((a) => ({ ...a, ...(live[a.agentId] ?? {}) }))} env={envelope} />

        {/* Stat strip — live actions (hire/register) update these in place */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {[
            { n: agents.length + extraAgents, l: "Agents registered" },
            { n: snapshot.settlements.length + extraSettlements, l: "Settlements" },
            // Sum, not max: total earned reputation visibly moves with every settlement.
            { n: agents.reduce((sum, a) => sum + (live[a.agentId]?.scoreBps ?? a.scoreBps), 0), l: "Network score (bps)" },
            { n: CONTRACTS.length, l: "Contracts deployed" },
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
              Who you can pay · wallet-free read
            </h2>
            {agents.map((a) => (
              <RegistryItem
                key={a.agentId}
                agent={a}
                live={live[a.agentId]}
                selected={a.agentId === selectedId}
                mine={a.agentId === myAgentId}
                bar={envelope?.minReputation}
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
                <span className="font-mono text-xs text-[#8E8E93]">{shownJobs} {shownJobs === 1 ? "job" : "jobs"} settled</span>
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
                Track record · settled escrows ({agentSettlements.length})
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

        {/* Contracts — the proof surface */}
        <div className="mt-6">
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

        {wallet.publicKey ? (
          <>
            <HirePanel
              publicKey={wallet.publicKey}
              agents={agents}
              rescanKey={extraAgents}
              onSettled={(providerId, rep) => {
                setLive((prev) => ({ ...prev, [providerId]: rep }));
                setExtraSettlements((n) => n + 1);
              }}
            />
            <RegisterPanel
              publicKey={wallet.publicKey}
              onRegistered={() => setExtraAgents((n) => n + 1)}
            />
          </>
        ) : (
          /* Locked preview — the console's strongest features must be visible
             BEFORE a wallet is connected, or first-time visitors never learn
             they exist. */
          <section className="glass-panel bg-white/5 border-accent-red/20 rounded-2xl p-6 md:p-8 mt-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-accent-red">
                Hire &amp; register · live on-chain flows
              </h2>
              <span className="font-mono text-[10px] text-[#8E8E93]">○ wallet not connected</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <span className="font-mono text-xs text-white font-bold block mb-1.5">Hire an agent</span>
                <p className="font-sans text-xs text-[#8E8E93] leading-relaxed">
                  Pick a provider, lock AGT in escrow, approve delivery — and watch its
                  reputation move on-chain from a transaction <span className="text-white">you</span> signed.
                  A test-token faucet is built in.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                <span className="font-mono text-xs text-white font-bold block mb-1.5">Register your agent</span>
                <p className="font-sans text-xs text-[#8E8E93] leading-relaxed">
                  Join the trust network: deposit a CSPR bond, sign with Casper Wallet, and
                  start earning a track record from settled jobs.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2">
              <button
                onClick={wallet.connect}
                disabled={wallet.connecting}
                className="inline-flex items-center gap-2.5 rounded-full bg-accent-red px-6 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-white shadow-md shadow-accent-red/20 transition-all duration-300 hover:bg-white hover:text-black disabled:opacity-60"
              >
                <span className={`h-1.5 w-1.5 rounded-full bg-white ${wallet.connecting ? "animate-ping" : ""}`} />
                {wallet.connecting ? "Connecting…" : "Connect Casper Wallet to unlock"}
              </button>
              {!wallet.available && (
                <a
                  href="https://www.casperwallet.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-[#8E8E93] hover:text-white transition-colors"
                >
                  Casper Wallet extension not detected — install it first ↗
                </a>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
