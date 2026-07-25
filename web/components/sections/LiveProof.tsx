"use client";

import { loadSnapshot } from "@/lib/data/snapshot";
import { useLiveAgents, mergeLiveAgents } from "@/lib/data/useLiveAgents";
import { liveProof } from "@/lib/content";
import { Reveal } from "@/components/motion/Reveal";
import { useState } from "react";
import type { SettlementProof } from "@/lib/casper/types";

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-8)}`;
}

function formatScoreDelta(before: number, after: number): string {
  const delta = after - before;
  // Shown to the account owner, who does not think in basis points.
  return delta > 0 ? "Track record grew" : "No change";
}

// Sub-component for individual spotlight transaction rows
function LiveProofRow({ s, idx }: { s: SettlementProof; idx: number }) {
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <Reveal key={s.txHash} delay={0.05 + idx * 0.05} className="w-full">
      <div
        onMouseMove={handleMouseMove}
        className="glass-panel bg-white/5 border-white/5 rounded-xl p-5 hover:bg-white/10 transition-all duration-300 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 spotlight-card"
        style={{
          "--mouse-x": `${coords.x}px`,
          "--mouse-y": `${coords.y}px`,
        } as React.CSSProperties}
      >
        <div className="spotlight-bg" />
        
        {/* Left info: hash & badge */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 relative z-10">
          <span className="w-6 h-6 rounded-full bg-accent-red/10 border border-accent-red/20 flex items-center justify-center font-mono text-[10px] text-accent-red font-bold shrink-0">
            TX
          </span>
          <div className="flex flex-col">
            <span className="font-mono text-sm text-white font-bold">
              {shortHash(s.txHash)}
            </span>
            <span className="font-mono text-[10px] text-[#8E8E93] uppercase tracking-wider mt-0.5">
              Paid job · receipt on file
            </span>
          </div>
        </div>

        {/* Right stats: delta & link */}
        <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0 relative z-10">
          <div className="flex flex-col text-right">
            <span className="font-mono text-sm text-green-400 font-bold">
              {formatScoreDelta(s.scoreBefore, s.scoreAfter)}
            </span>
            <span className="font-mono text-[9px] text-[#8E8E93] uppercase tracking-widest mt-0.5">
              After this job
            </span>
          </div>

          <a
            href={`https://testnet.cspr.live/deploy/${s.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center p-2.5 bg-white/5 hover:bg-accent-red hover:text-white rounded-lg text-xs font-semibold text-white transition-all duration-300 group"
            aria-label={`View transaction ${s.txHash} on cspr.live`}
          >
            <span className="font-sans text-[10px] uppercase tracking-widest mr-1">Receipt</span>
            <span className="font-mono text-xs transform group-hover:translate-x-0.5 transition-transform">↗</span>
          </a>
        </div>

      </div>
    </Reveal>
  );
}

export function LiveProof() {
  const live = useLiveAgents();
  const snapshot = mergeLiveAgents(loadSnapshot(), live);
  const agent0 = snapshot.agents.find((a) => a.agentId === 0);
  const isLive = Object.keys(live).length > 0;
  const [coordsRep, setCoordsRep] = useState({ x: 0, y: 0 });

  const handleMouseMoveRep = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoordsRep({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <section
      id="live-proof"
      className="relative w-full bg-bg py-24 md:py-36 overflow-hidden"
      aria-labelledby="lp-headline"
    >
      <div className="absolute inset-0 bg-glow-red opacity-30 pointer-events-none z-0" />

      <div className="mx-auto max-w-[1200px] px-6 md:px-12 relative z-10">
        
        {/* Section header — left-aligned, same rhythm as the rest of the page.
            The old split grid pushed the heading into the right column and left
            half the viewport empty. */}
        <Reveal>
          <div className="flex max-w-[62ch] flex-col gap-4 mb-14">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-red">
              {liveProof.label}
            </span>
            <h2
              id="lp-headline"
              className="font-sans text-[clamp(2rem,4.2vw,3.4rem)] font-black leading-[1.05] tracking-[-0.02em] text-white"
            >
              {liveProof.headlinePre}{" "}
              <span className="text-accent-red">{liveProof.headlineAccent}</span>{" "}
              {liveProof.headlinePost}
            </h2>
          </div>
        </Reveal>

        {/* Bento Grid: 12-column grid system */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch mt-12">
          
          {/* Reputation Summary Card (col-span-4) */}
          <div className="md:col-span-4 flex">
            <Reveal className="w-full flex">
              <div
                onMouseMove={handleMouseMoveRep}
                className="w-full glass-panel bg-white/5 border-white/5 rounded-2xl p-8 flex flex-col justify-between min-h-[300px] spotlight-card"
                style={{
                  "--mouse-x": `${coordsRep.x}px`,
                  "--mouse-y": `${coordsRep.y}px`,
                } as React.CSSProperties}
              >
                <div className="spotlight-bg" />
                
                <div className="flex flex-col gap-2 relative z-10">
                  <span className="font-sans text-xs text-[#8E8E93]">Most trusted</span>
                  <h3 className="font-sans text-xl font-bold text-white">Top vendor</h3>
                </div>

                <div className="py-6 border-y border-white/5 flex flex-col gap-3 relative z-10">
                  {/* The count of finished, paid work — the thing an owner would
                      actually judge a vendor on. */}
                  <div className="flex items-baseline gap-2">
                    <span className="font-sans text-6xl font-black text-white tracking-tight tabular-nums">
                      {agent0?.jobsCompleted ?? 0}
                    </span>
                    <span className="font-sans text-sm font-semibold text-green-400">
                      jobs finished
                    </span>
                  </div>
                  {/* Real-time validator telemetry line */}
                  <div className="h-6 w-full relative mt-2">
                    <svg className="w-full h-full text-accent-red" viewBox="0 0 120 24" fill="none" preserveAspectRatio="none">
                      <path d="M0 12 H30 L36 4 L44 20 L50 12 H120" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-20" />
                      <path d="M0 12 H30 L36 4 L44 20 L50 12 H120" stroke="url(#pulse-gradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="30, 90" strokeDashoffset="0">
                        <animate attributeName="stroke-dashoffset" values="120;0" dur="2.5s" repeatCount="indefinite" />
                      </path>
                      <defs>
                        <linearGradient id="pulse-gradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="rgba(230, 33, 47, 0)" />
                          <stop offset="50%" stopColor="#E6212F" />
                          <stop offset="100%" stopColor="rgba(230, 33, 47, 0)" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>

                <div className="flex items-center justify-between font-sans text-xs text-[#8E8E93] relative z-10">
                  <span>Paid by</span>
                  <span className="font-semibold text-white">
                    {new Set(
                      snapshot.settlements.filter((s) => s.to === (agent0?.agentId ?? 0)).map((s) => s.from),
                    ).size}{" "}
                    different customers
                  </span>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Settlements List Cards (col-span-8) */}
          <div className="md:col-span-8 flex flex-col gap-4">
            {snapshot.settlements.slice(0, 4).map((s, idx) => (
              <LiveProofRow key={s.txHash} s={s} idx={idx} />
            ))}
          </div>

        </div>

        {/* Footer Note */}
        <Reveal delay={0.4}>
          <div className="mt-12 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-6 border-t border-white/5 pt-8">
            <p className="font-sans text-sm text-[#8E8E93] leading-relaxed max-w-[56ch]">
              {liveProof.footerNote(snapshot.settlements.length, snapshot.agents.length)}
            </p>
            <div className="flex flex-col items-start sm:items-end text-xs font-mono text-[#8E8E93]/60">
              <span>Network: {snapshot.network}</span>
              {/* ISO date: locale-dependent formatting here breaks hydration (React #418) */}
              <span className="mt-1">
                {isLive
                  ? "Scores: live · read from chain"
                  : `Captured: ${new Date(snapshot.capturedAt).toISOString().slice(0, 10)}`}
              </span>
            </div>
          </div>
        </Reveal>

      </div>
    </section>
  );
}
