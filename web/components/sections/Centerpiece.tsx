"use client";

import { useEffect, useState } from "react";
import type { TrustSnapshot } from "@/lib/casper/types";

interface CenterpieceProps {
  data: TrustSnapshot;
}

interface SimulatedLog {
  id: string;
  time: string;
  action: string;
  status: "success" | "pending" | "info";
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

export function Centerpiece({ data }: CenterpieceProps) {
  const agent = data.agents.find((a) => a.agentId === 0) ?? data.agents[0];
  const [liveScore, setLiveScore] = useState(agent.scoreBps);
  const [logs, setLogs] = useState<SimulatedLog[]>(() => [
    { id: "1", time: "12:04:12", action: "Identity verified for Agent#0", status: "success" },
    { id: "2", time: "12:04:28", action: `Escrow settled: tx ${shortHash(data.settlements[0].txHash)}`, status: "success" },
    { id: "3", time: "12:05:01", action: "Escrow funds locked (250 CSPR)", status: "info" },
  ]);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  // Simulated live event feed
  useEffect(() => {
    // Periodic simulation
    const actions = [
      "Trust check: minScore 9000 passed",
      "Escrow contract initialized",
      "Signature verified on Casper Testnet",
      "Reputation incremented (+5 bps)",
      "x402 payment checkpoint reached",
    ];

    const timer = setInterval(() => {
      const randomAction = actions[Math.floor(Math.random() * actions.length)];
      const now = new Date();
      const timeStr = now.toTimeString().split(" ")[0];

      // Occasional score fluctuations
      if (Math.random() > 0.6) {
        setLiveScore((prev) => {
          const delta = Math.random() > 0.4 ? 1 : -1;
          const nextScore = Math.max(100, Math.min(10000, prev + delta));
          return nextScore;
        });
      }

      setLogs((prev) => [
        {
          id: Math.random().toString(),
          time: timeStr,
          action: randomAction,
          status: randomAction.includes("passed") || randomAction.includes("incremented") ? "success" : "info",
        },
        ...prev.slice(0, 4),
      ]);
    }, 4000);

    return () => clearInterval(timer);
  }, [data]);

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
          <span className="font-mono text-5xl md:text-6xl font-black text-white tracking-tight tabular-nums transition-all duration-500">
            {liveScore}
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

      {/* Simulated Live Console Logs */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">
            Live Event Feed
          </span>
          <span className="font-mono text-[9px] text-[#8E8E93]/60 animate-pulse">
            listening...
          </span>
        </div>
        
        <div className="bg-black/40 border border-white/5 rounded-lg p-4 font-mono text-[11px] leading-relaxed text-[#8E8E93] flex flex-col gap-2.5 h-[140px] overflow-y-hidden">
          {logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2.5 animate-fadeIn">
              <span className="text-white/40 shrink-0">{log.time}</span>
              <span className="text-accent-red shrink-0">&gt;</span>
              <span className={`flex-1 ${log.status === "success" ? "text-green-400" : "text-[#8E8E93]"}`}>
                {log.action}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Real On-Chain Transactions */}
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
