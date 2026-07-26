"use client";

import { useEffect, useMemo, useState } from "react";
import { loadSnapshot } from "@/lib/data/snapshot";
import { WalletButton } from "@/components/dashboard/WalletButton";
import { RegisterPanel } from "@/components/dashboard/RegisterPanel";
import { HirePanel } from "@/components/dashboard/HirePanel";
import { MyAgentPanel } from "@/components/dashboard/MyAgentPanel";
import { VaultDashboard } from "@/components/dashboard/VaultDashboard";
import { SpendingEnvelope, type Envelope } from "@/components/dashboard/SpendingEnvelope";
import { useCasperWallet } from "@/lib/wallet/useCasperWallet";
import type { AgentSnapshot, SettlementProof } from "@/lib/casper/types";

const SCORE_MAX = 500;

type LiveRep = { scoreBps: number; jobsCompleted: number };

const CONTRACTS = [
  { name: "AgentVaults", pkg: "674cc233514a5e478f84ea37d657cc6b58d41984b788778d6ca554e6615d6914" },
  { name: "IdentityRegistry", pkg: "3a51cc5f4c524f806b3b8899039030bbad141005f81ab99895615d8f050c7adc" },
  { name: "ReputationEngine", pkg: "d73fb11144c07ec05071cf986ad65b407f2da91bd871b0c10f67a974832ee7eb" },
  { name: "Escrow", pkg: "fe6b0ddb307549cc9101659abcfaf114e37a8d99461c0632cbce582ebdc4902c" },
  { name: "AgentTreasury", pkg: "95a5cde87caeeee469f6708b4cdbb8ee6b74bf9a50bab429287cc1400ef32f1a" },
  { name: "Cep18 (AGT)", pkg: "f962076e6c2ba423aaade9f75935ff37ef4aa4cde6077bac9a259af141c3d5c6" },
];

const TABS = [
  { id: "account", label: "Account", hint: "Your money and your rules" },
  { id: "vendors", label: "Vendors", hint: "Who you are allowed to pay" },
  { id: "activity", label: "Activity", hint: "Every settlement on the network" },
  { id: "contracts", label: "Contracts", hint: "The code all of this runs on" },
] as const;

type Tab = (typeof TABS)[number]["id"];

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
          : "border-line bg-surface hover:border-ink/20 hover:bg-subtle"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-bold text-ink">
          Agent #{agent.agentId}
          {mine && (
            <span className="ml-2 rounded border border-accent-red/40 bg-accent-red/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-accent-red align-middle">
              yours
            </span>
          )}
        </span>
        <span className="font-mono text-lg font-black tabular-nums text-ink">
          {scoreBps}
          <span className="text-[10px] font-medium text-muted ml-1">bps</span>
          {live && <span className="ml-1.5 text-[9px] font-medium text-ok align-middle">● live</span>}
        </span>
      </div>
      <div className="mt-3 h-1 w-full rounded-full bg-subtle overflow-hidden">
        <div
          className="h-full rounded-full bg-linear-to-r from-accent-red to-orange-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted">
        <span>{jobsCompleted} {jobsCompleted === 1 ? "job" : "jobs"} settled</span>
        {/* Framed as the owner's decision, not an abstract label: can I pay this one? */}
        {bar === undefined ? (
          <span className={scoreBps > 0 ? "text-orange-400" : "text-muted"}>
            {scoreBps > 0 ? "earning" : "unproven"}
          </span>
        ) : (
          <span className={scoreBps >= bar ? "text-ok" : "text-accent-red"}>
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
      className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3 font-mono text-xs transition-colors hover:border-ink/20 hover:bg-subtle"
    >
      <span className={`shrink-0 text-[9px] uppercase tracking-widest ${earned ? "text-ok" : "text-muted"}`}>
        {earned ? `earned · from #${s.from}` : `paid → #${s.to}`}
      </span>
      <span className="text-ink">{short(s.txHash)}</span>
      {/* An outgoing row's delta belongs to the counterparty — show it neutral, not as a gain */}
      <span className={`font-bold ${earned && delta > 0 ? "text-ok" : "text-muted"}`}>
        {earned ? `${delta > 0 ? "+" : ""}${delta} bps` : `#${s.to} gains +${delta} bps`}
      </span>
      <span className="text-accent-red">↗</span>
    </a>
  );
}

export function TrustDashboard() {
  const snapshot = loadSnapshot();
  const wallet = useCasperWallet();
  const [tab, setTab] = useState<Tab>("account");
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

  const walletButton = (
    <WalletButton
      connecting={wallet.connecting}
      publicKey={wallet.publicKey}
      error={wallet.error}
      connect={wallet.connect}
      disconnect={wallet.disconnect}
    />
  );

  const active = TABS.find((t) => t.id === tab)!;

  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="fixed inset-0 bg-grid opacity-20 pointer-events-none" />

      <div className="relative flex min-h-screen">
        {/* Rail — the app's spine. Where you are never moves. */}
        <aside className="hidden lg:flex w-[252px] shrink-0 flex-col justify-between border-r border-line bg-surface/70 px-5 py-8 sticky top-0 h-screen">
          <div className="flex flex-col gap-8">
            <a href="/" className="flex flex-col gap-0.5 group">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted group-hover:text-ink transition-colors">
                ← Casper
              </span>
              <span className="font-sans text-lg font-black tracking-tight text-ink">
                <span className="text-accent-red">Trust</span> Layer
              </span>
            </a>

            <nav className="flex flex-col gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all duration-200 ${
                    tab === t.id
                      ? "bg-accent-red/[0.07] text-ink"
                      : "text-muted hover:bg-subtle hover:text-ink"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                      tab === t.id ? "bg-accent-red" : "bg-line group-hover:bg-muted"
                    }`}
                  />
                  <span className="font-sans text-sm font-semibold">{t.label}</span>
                </button>
              ))}
            </nav>
          </div>

          <div className="flex flex-col gap-3">
            <span className="inline-flex w-fit items-center gap-1.5 rounded border border-accent-red/20 bg-accent-red/5 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-accent-red">
              <span className="h-1 w-1 rounded-full bg-accent-red" />
              {snapshot.network}
            </span>
            {walletButton}
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {/* Phone + tablet: the rail lies down into a scrollable strip. */}
          <div className="lg:hidden sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-6 pt-5">
              <a href="/" className="font-sans text-base font-black tracking-tight text-ink">
                <span className="text-accent-red">Trust</span> Layer
              </a>
              {walletButton}
            </div>
            <div className="flex gap-1 overflow-x-auto px-6 pb-3 pt-3">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 font-sans text-xs font-semibold transition-colors ${
                    tab === t.id
                      ? "bg-accent-red/10 text-ink"
                      : "text-muted hover:bg-subtle hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mx-auto max-w-[1000px] px-6 md:px-10 py-8 lg:py-10 flex flex-col gap-6">
            <header className="flex flex-col gap-1">
              <h1 className="font-sans text-2xl md:text-3xl font-black tracking-tight text-ink">
                {active.label}
              </h1>
              <p className="font-sans text-sm text-muted">{active.hint}</p>
            </header>

        {tab === "account" && wallet.publicKey && <VaultDashboard publicKey={wallet.publicKey} />}

        {/* Without a wallet this tab used to open on OUR treasury, under a heading
            that says "your money" — so say plainly whose account is on screen. */}
        {tab === "account" && !wallet.publicKey && (
          <section className="glass-panel bg-surface border-line rounded-2xl p-6 md:p-8 flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <h2 className="font-sans text-xl font-black tracking-tight text-ink">
                You don&apos;t have an account here yet
              </h2>
              <p className="font-sans text-sm leading-relaxed text-muted max-w-[52ch]">
                Opening one takes a single transaction. You write the limits — how much per
                job, how much per day, how much track record a vendor needs — and{" "}
                <span className="text-ink font-semibold">you</span> sign it. The rules live in
                the contract from that moment on, so neither your agent nor we can move past
                them.
              </p>
            </div>

            <div className="flex flex-col items-start gap-2">
              <button
                onClick={wallet.connect}
                disabled={wallet.connecting}
                className="inline-flex items-center gap-2.5 rounded-full bg-accent-red px-6 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-bg shadow-md shadow-accent-red/20 transition-all duration-300 hover:bg-ink hover:text-bg disabled:opacity-60"
              >
                <span className={`h-1.5 w-1.5 rounded-full bg-white ${wallet.connecting ? "animate-ping" : ""}`} />
                {wallet.connecting ? "Connecting…" : "Connect wallet to open yours"}
              </button>
              {!wallet.available && (
                <a
                  href="https://www.casperwallet.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-muted hover:text-ink transition-colors"
                >
                  Casper Wallet extension not detected — install it first ↗
                </a>
              )}
            </div>

            <p className="font-sans text-xs leading-relaxed text-muted border-t border-line pt-4">
              No wallet handy? The account below is <span className="text-ink">ours</span>, funded
              with test tokens — try to break its rules and watch the contract refuse you.
            </p>
          </section>
        )}

        {tab === "account" && wallet.publicKey && (
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
        {tab === "account" && (
          <SpendingEnvelope agents={agents.map((a) => ({ ...a, ...(live[a.agentId] ?? {}) }))} env={envelope} />
        )}

        {/* Stat strip — live actions (hire/register) update these in place */}
        {tab === "contracts" && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { n: agents.length + extraAgents, l: "Agents registered" },
            { n: snapshot.settlements.length + extraSettlements, l: "Settlements" },
            // Sum, not max: total earned reputation visibly moves with every settlement.
            { n: agents.reduce((sum, a) => sum + (live[a.agentId]?.scoreBps ?? a.scoreBps), 0), l: "Network score (bps)" },
            { n: CONTRACTS.length, l: "Contracts deployed" },
          ].map((s) => (
            <div key={s.l} className="glass-panel bg-surface border-line rounded-xl p-4">
              <div className="font-mono text-3xl font-black tabular-nums text-ink">{s.n}</div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted mt-1">{s.l}</div>
            </div>
          ))}
        </div>
        )}

        {/* Registry + detail */}
        {tab === "vendors" && (
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.6fr] gap-6">
          {/* Registry */}
          <section className="flex flex-col gap-3">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted">
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
          <section className="glass-panel bg-surface border-line rounded-2xl p-6 md:p-8 flex flex-col gap-6">
            <div className="flex items-start justify-between">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  Agent #{selected.agentId} · on-chain reputation
                </span>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-6xl font-black tabular-nums text-ink">{shownScore}</span>
                  <span className="font-mono text-sm text-ok font-bold uppercase">bps</span>
                  {liveScore !== undefined && (
                    <span className="font-mono text-[10px] text-ok">✓ live</span>
                  )}
                </div>
                <span className="font-mono text-xs text-muted">{shownJobs} {shownJobs === 1 ? "job" : "jobs"} settled</span>
              </div>
              <button
                onClick={refreshLive}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-ink transition-all duration-300 hover:border-ink/30 hover:bg-subtle disabled:opacity-50"
              >
                <span className={`h-1.5 w-1.5 rounded-full bg-accent-red ${loading ? "animate-ping" : ""}`} />
                {loading ? "Reading…" : "Read live"}
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Track record · settled escrows ({agentSettlements.length})
              </span>
              <div className="flex flex-col gap-2">
                {agentSettlements.length > 0 ? (
                  agentSettlements.map((s) => <SettlementRow key={s.txHash} s={s} agentId={selectedId} />)
                ) : (
                  <p className="font-mono text-xs text-muted py-4">
                    No settlements yet — this agent is unproven.
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
        )}

        {/* Every settlement on the network, newest first — the ledger behind every score. */}
        {tab === "activity" && (
          <section className="glass-panel bg-surface border-line rounded-2xl p-6 md:p-8 flex flex-col gap-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Settled escrows · wallet-free read
              </h2>
              <span className="font-mono text-[10px] text-muted">
                {snapshot.settlements.length + extraSettlements} total
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {[...snapshot.settlements].reverse().map((s) => (
                <SettlementRow key={s.txHash} s={s} agentId={s.to} />
              ))}
            </div>
            <p className="font-sans text-xs leading-relaxed text-muted">
              Every row is a payment a client actually approved. That approval is what moves a
              score — nobody votes, and nothing here can be written without spending money.
            </p>
          </section>
        )}

        {/* Contracts — the proof surface */}
        {tab === "contracts" && (
          <section className="glass-panel bg-surface border-line rounded-2xl p-6 md:p-8">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted mb-4">
              Live contracts · casper-test
            </h2>
            <div className="flex flex-col gap-2">
              {CONTRACTS.map((c) => (
                <a
                  key={c.name}
                  href={`https://testnet.cspr.live/contract-package/${c.pkg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-2.5 font-mono text-xs transition-colors hover:border-ink/20 hover:bg-subtle"
                >
                  <span className="text-ink">{c.name}</span>
                  <span className="text-muted">{c.pkg.slice(0, 8)}… <span className="text-accent-red">↗</span></span>
                </a>
              ))}
            </div>
          </section>
        )}

        {tab === "account" && (wallet.publicKey ? (
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
          <section className="glass-panel bg-surface border-accent-red/20 rounded-2xl p-6 md:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-accent-red">
                Hire &amp; register · live on-chain flows
              </h2>
              <span className="font-mono text-[10px] text-muted">○ wallet not connected</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border border-line bg-subtle p-4">
                <span className="font-mono text-xs text-ink font-bold block mb-1.5">Hire an agent</span>
                <p className="font-sans text-xs text-muted leading-relaxed">
                  Pick a provider, lock AGT in escrow, approve delivery — and watch its
                  reputation move on-chain from a transaction <span className="text-ink">you</span> signed.
                  A test-token faucet is built in.
                </p>
              </div>
              <div className="rounded-xl border border-line bg-subtle p-4">
                <span className="font-mono text-xs text-ink font-bold block mb-1.5">Register your agent</span>
                <p className="font-sans text-xs text-muted leading-relaxed">
                  Join the trust network: deposit a CSPR bond, sign with Casper Wallet, and
                  start earning a track record from settled jobs.
                </p>
              </div>
            </div>
            <p className="font-sans text-xs text-muted">
              Both unlock with the same wallet connection as the account above.
            </p>
          </section>
        ))}
          </div>
        </div>
      </div>
    </main>
  );
}
