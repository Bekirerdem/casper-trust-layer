"use client";

import { useEffect, useState } from "react";

/** The reputation gate the deployed AgentTreasury enforces (set_reputation_policy(.., 1)). */
const TREASURY_MIN_SCORE = 1;
const SCORE_MAX = 500;

type Passport = {
  agentId: number;
  wallet: string;
  agentUri: string;
  bond: string;
  status: "Active" | "Slashed" | "Withdrawn";
  scoreBps: number;
  jobsCompleted: number;
  distinctClients: number;
  totalVolume: string;
  grantedOutBps: number;
};

/** motes → whole units (both CSPR and our CEP-18 use 9 decimals). */
function fromMotes(motes: string, maxFractionDigits = 3): string {
  const n = Number(motes) / 1e9;
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-US", { maximumFractionDigits: maxFractionDigits });
}

function clearance(scoreBps: number): { label: string; tone: string } {
  if (scoreBps >= 100) return { label: "TRUSTED", tone: "text-green-400 border-green-400/30 bg-green-400/5" };
  if (scoreBps > 0) return { label: "EARNING", tone: "text-orange-400 border-orange-400/30 bg-orange-400/5" };
  return { label: "UNPROVEN", tone: "text-[#8E8E93] border-white/10 bg-white/5" };
}

export function MyAgentPanel({
  publicKey,
  rescanKey = 0,
  onResolved,
}: {
  publicKey: string;
  /** Bump after a register tx so the panel re-scans for the new agent. */
  rescanKey?: number;
  /** Reports the wallet's primary agent id so the console can focus it. */
  onResolved?: (agentId: number) => void;
}) {
  const [ids, setIds] = useState<number[] | null>(null);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [copied, setCopied] = useState(false);

  // Which agents does this wallet own?
  useEffect(() => {
    let cancelled = false;
    setIds(null);
    setPassport(null);
    fetch(`/api/agents/mine?publicKey=${publicKey}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { agentIds?: number[] }) => {
        if (cancelled) return;
        const found = d.agentIds ?? [];
        setIds(found);
        if (found.length > 0) onResolved?.(found[0]);
      })
      .catch(() => {
        if (!cancelled) setIds([]);
      });
    return () => {
      cancelled = true;
    };
    // onResolved is a stable callback from the parent; re-running on identity
    // changes would refetch the registry scan on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey, rescanKey]);

  // Full passport for the primary agent.
  useEffect(() => {
    const id = ids?.[0];
    if (id === undefined) return;
    let cancelled = false;
    fetch(`/api/agents/${id}/passport`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Passport | null) => {
        if (!cancelled && d && !("error" in d)) setPassport(d);
      })
      .catch(() => {
        /* the identity strip simply stays minimal */
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  async function copyProfile(agentId: number) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/app?agent=${agentId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is still in the URL bar after selecting an agent */
    }
  }

  const scanning = ids === null;
  const agentId = ids?.[0];
  const owned = agentId !== undefined;
  const cl = clearance(passport?.scoreBps ?? 0);
  const pct = Math.min(100, ((passport?.scoreBps ?? 0) / SCORE_MAX) * 100);

  return (
    <section className="glass-panel bg-white/5 border-white/10 rounded-2xl p-6 md:p-8 mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="font-mono text-[10px] uppercase tracking-widest text-accent-red">
          My Agent · this wallet
        </h2>
        {owned && (
          <button
            onClick={() => copyProfile(agentId)}
            className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93] hover:text-white transition-colors"
          >
            {copied ? "✓ link copied" : "Copy profile link ↗"}
          </button>
        )}
      </div>

      {scanning && (
        <p className="font-mono text-xs text-[#8E8E93]">Scanning the registry for your agent…</p>
      )}

      {!scanning && !owned && (
        <div className="flex flex-col gap-3">
          <p className="font-sans text-sm text-[#8E8E93] max-w-[62ch] leading-relaxed">
            No agent is registered to this wallet yet. Your identity, your bond and the track
            record you earn all live on-chain — <span className="text-white">register below</span> and
            this panel becomes your agent&apos;s passport.
          </p>
        </div>
      )}

      {owned && (
        <div className="flex flex-col gap-6">
          {/* Identity + earned score */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-sm font-bold text-white">Agent #{agentId}</span>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-5xl font-black tabular-nums text-white">
                  {passport?.scoreBps ?? "—"}
                </span>
                <span className="font-mono text-sm font-bold uppercase text-green-400">bps</span>
                {passport && <span className="font-mono text-[10px] text-green-400">● live</span>}
              </div>
            </div>
            <span
              className={`rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-widest ${cl.tone}`}
            >
              {cl.label}
            </span>
          </div>

          <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-linear-to-r from-accent-red to-orange-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Everything the contracts already store, finally surfaced */}
          {passport && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { v: passport.jobsCompleted, l: "Jobs settled" },
                { v: passport.distinctClients, l: "Distinct clients" },
                { v: fromMotes(passport.totalVolume), l: "AGT earned" },
                { v: fromMotes(passport.bond, 0), l: "CSPR bonded" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="font-mono text-2xl font-black tabular-nums text-white">{s.v}</div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93] mt-1">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Clearance — what this score actually unlocks */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-4 flex flex-col gap-3">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">
              Clearance
            </span>
            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
              <span className="text-white">
                Treasury reputation gate{" "}
                <span className="text-[#8E8E93]">(score ≥ {TREASURY_MIN_SCORE} bps)</span>
              </span>
              <span
                className={
                  (passport?.scoreBps ?? 0) >= TREASURY_MIN_SCORE ? "text-green-400" : "text-accent-red"
                }
              >
                {(passport?.scoreBps ?? 0) >= TREASURY_MIN_SCORE ? "✓ CLEARS" : "✕ BELOW BAR"}
              </span>
            </div>
            <p className="font-sans text-xs text-[#8E8E93] leading-relaxed">
              Per-task 100 AGT · daily 500 AGT · payouts release only to a payee that is whitelisted{" "}
              <span className="text-white">or</span> clears this gate — enforced in the contract, not the SDK.
            </p>
          </div>

          {passport && (
            <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">
              <span>
                Status <span className={passport.status === "Active" ? "text-green-400" : "text-accent-red"}>{passport.status}</span>
              </span>
              <span className="break-all normal-case tracking-normal">{passport.agentUri}</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
