"use client";

import { useEffect, useState } from "react";
import type { TrustSnapshot } from "@/lib/casper/types";

interface CenterpieceProps {
  data: TrustSnapshot;
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export function Centerpiece({ data }: CenterpieceProps) {
  const agent = data.agents.find((a) => a.agentId === 0) ?? data.agents[0];
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  // Real event feed — every line is an actual on-chain settlement from the
  // snapshot. No fabricated actions, times, or score fluctuations.
  const events = data.settlements.map((s) => {
    const delta = s.scoreAfter - s.scoreBefore;
    return {
      id: s.txHash,
      tx: shortHash(s.txHash),
      action: `settled +${delta} bps → agent #${s.to}`,
      success: delta > 0,
    };
  });

  // Rotate the real events so the feed feels live without inventing anything.
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (events.length <= 3) return;
    const timer = setInterval(() => setOffset((o) => (o + 1) % events.length), 3000);
    return () => clearInterval(timer);
  }, [events.length]);

  const visible = Array.from({ length: Math.min(3, events.length) }, (_, i) =>
    events[(offset + i) % events.length],
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="flex flex-col gap-6 text-left spotlight-card relative z-10"
      style={{
        "--mouse-x": `${coords.x}px`,
        "--mouse-y": `${coords.y}px`,
      } as React.CSSProperties}
      aria-label="Live Agent Reputation Widget"
    >
      <div className="spotlight-bg" />
      {/* Widget Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="font-mono text-xs uppercase tracking-widest text-[#8E8E93]">
            Agent#0 Reputation
          </span>
        </div>
        <span className="font-mono text-[10px] text-accent-red font-bold tracking-widest uppercase border border-accent-red/20 px-2 py-0.5 rounded bg-accent-red/5">
          {data.network}
        </span>
      </div>

      {/* Main Score Metrics */}
      <div className="grid grid-cols-2 gap-4 py-2">
        <div className="flex flex-col">
          <span className="font-mono text-5xl md:text-6xl font-black text-white tracking-tight tabular-nums">
            {agent.scoreBps}
          </span>
          <span className="text-[10px] font-sans uppercase tracking-[0.15em] text-[#8E8E93] mt-1">
            Score (BPS)
          </span>
        </div>
        <div className="flex flex-col border-l border-white/10 pl-6">
          <span className="font-mono text-5xl md:text-6xl font-black text-white tracking-tight tabular-nums">
            {agent.jobsCompleted}
          </span>
          <span className="text-[10px] font-sans uppercase tracking-[0.15em] text-[#8E8E93] mt-1">
            Jobs Settled
          </span>
        </div>
      </div>

      {/* Live Event Feed — real settlements */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">
            Settlement Feed
          </span>
          <span className="font-mono text-[9px] text-[#8E8E93]/60 animate-pulse">
            on-chain · live
          </span>
        </div>

        <div className="bg-black/40 border border-white/5 rounded-lg p-4 font-mono text-[11px] leading-relaxed text-[#8E8E93] flex flex-col gap-2.5 h-[140px] overflow-y-hidden">
          {visible.map((log) => (
            <div key={log.id} className="flex items-start gap-2.5 animate-fadeIn">
              <span className="text-accent-red shrink-0">{log.tx}</span>
              <span
                className={`flex-1 ${log.success ? "text-green-400" : "text-[#8E8E93]"}`}
              >
                {log.action}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Verify on-chain */}
      <div className="flex flex-col gap-2 pt-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">
          Recent Casper Deploys
        </span>
        <div className="flex flex-col gap-1.5">
          {data.settlements.slice(0, 3).map((s) => (
            <a
              key={s.txHash}
              href={`https://testnet.cspr.live/deploy/${s.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-lg text-[11px] font-mono transition-colors text-[#8E8E93] hover:text-white"
            >
              <span className="text-accent-red font-bold">TX</span>
              <span>{shortHash(s.txHash)}</span>
              <span className="text-green-500 font-semibold">+{s.scoreAfter - s.scoreBefore} bps</span>
              <span className="text-[9px] uppercase tracking-widest text-[#8E8E93]/40 group-hover:text-white/60">
                verify ↗
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
