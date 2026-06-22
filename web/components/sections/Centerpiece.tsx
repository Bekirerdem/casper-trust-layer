"use client";

import { Reveal } from "@/components/motion/Reveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { TrustSnapshot } from "@/lib/casper/types";

// ── helpers ──────────────────────────────────────────────────────────────────

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function bpsToScore(bps: number): string {
  return (bps / 100).toFixed(2);
}

// ── Main Centerpiece export ──────────────────────────────────────────────────

interface CenterpieceProps {
  data: TrustSnapshot;
}

export function Centerpiece({ data }: CenterpieceProps) {
  // Agent#0 is the primary agent with real data
  const agent = data.agents.find((a) => a.agentId === 0) ?? data.agents[0];

  return (
    <div
      className="flex flex-col gap-0 border-t border-line"
      aria-label="Agent trust proof panel"
    >
      {/* ── Header label ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between py-4 border-b border-line">
        <SectionLabel>Agent#0 · Testnet</SectionLabel>
        <span className="font-mono text-[10px] text-muted tracking-wider uppercase">
          {data.network}
        </span>
      </div>

      {/* ── Big number: scoreBps ─────────────────────────────────── */}
      <Reveal>
        <div className="py-8 border-b border-line">
          <p className="font-mono text-[clamp(3.5rem,10vw,5.5rem)] font-semibold leading-none tabular-nums text-text">
            {bpsToScore(agent.scoreBps)}
          </p>
          <p className="mt-2 text-xs font-sans uppercase tracking-[0.10em] text-muted">
            Trust Score (bps ÷ 100)
          </p>
        </div>
      </Reveal>

      {/* ── Stat row: jobs completed ─────────────────────────────── */}
      <Reveal delay={0.06}>
        <div className="flex items-baseline gap-3 py-5 border-b border-line">
          <span className="font-mono text-[2rem] font-semibold tabular-nums text-text leading-none">
            {agent.jobsCompleted}
          </span>
          <span className="text-xs font-sans uppercase tracking-[0.10em] text-muted">
            Jobs completed
          </span>
        </div>
      </Reveal>

      {/* ── Settlement list ──────────────────────────────────────── */}
      <Reveal delay={0.12}>
        <div className="flex flex-col gap-0">
          <p className="py-3 text-[10px] font-sans uppercase tracking-[0.10em] text-muted border-b border-line">
            Settled on-chain
          </p>
          {data.settlements.map((s) => {
            const delta = s.scoreAfter - s.scoreBefore;
            return (
              <a
                key={s.txHash}
                href={`https://testnet.cspr.live/deploy/${s.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-4 py-3 border-b border-line last:border-0 hover:bg-[#FBF8F3] transition-colors"
                aria-label={`View transaction ${s.txHash} on cspr.live`}
              >
                {/* tx hash */}
                <span className="font-mono text-[11px] text-muted group-hover:text-text transition-colors shrink-0">
                  {shortHash(s.txHash)}
                </span>

                {/* score delta */}
                {delta !== 0 && (
                  <span className="font-mono text-[11px] text-muted shrink-0">
                    +{delta}&nbsp;<span className="text-[9px] uppercase tracking-wider">bps</span>
                  </span>
                )}

                {/* cspr.live indicator */}
                <span className="font-sans text-[9px] uppercase tracking-widest text-muted/50 group-hover:text-muted transition-colors shrink-0 ml-auto">
                  cspr.live ↗
                </span>
              </a>
            );
          })}
        </div>
      </Reveal>

      {/* ── Snapshot timestamp ───────────────────────────────────── */}
      <p className="pt-4 font-mono text-[9px] text-muted/40 tabular-nums">
        snapshot {new Date(data.capturedAt).toISOString().slice(0, 10)}
      </p>
    </div>
  );
}
