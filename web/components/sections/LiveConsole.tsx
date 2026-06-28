"use client";

import { loadSnapshot } from "@/lib/data/snapshot";
import { liveConsole } from "@/lib/content";
import { Reveal } from "@/components/motion/Reveal";
import { useState } from "react";

const MIN = 0;
const MAX = 500;

export function LiveConsole() {
  const snapshot = loadSnapshot();
  const agents = snapshot.agents;

  const [agentId, setAgentId] = useState(0);
  const [minScore, setMinScore] = useState(100);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [live, setLive] = useState<{ scoreBps: number; at: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [liveError, setLiveError] = useState(false);

  const agent = agents.find((a) => a.agentId === agentId) ?? agents[0];
  const score = live?.scoreBps ?? agent.scoreBps;
  const approved = score >= minScore;

  // Latest settlement where this agent was the paid provider — the on-chain proof.
  const proof = snapshot.settlements.find((s) => s.to === agentId);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  function selectAgent(id: number) {
    setAgentId(id);
    setLive(null);
    setLiveError(false);
  }

  async function reread() {
    setLoading(true);
    setLiveError(false);
    try {
      const res = await fetch(`/api/trust/${agentId}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { scoreBps: number };
      setLive({
        scoreBps: data.scoreBps,
        at: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      });
    } catch {
      setLiveError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      id="console"
      className="relative w-full bg-bg py-24 md:py-36 overflow-hidden"
      aria-labelledby="lc-headline"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-glow-red opacity-30 pointer-events-none z-0" />

      <div className="mx-auto max-w-[1200px] px-6 md:px-12 relative z-10">
        {/* Section header */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2.5fr] gap-8 lg:gap-20 items-start mb-16 md:mb-24">
          <Reveal>
            <div className="flex flex-col gap-4">
              <span className="font-mono text-xs font-bold tracking-[0.2em] text-accent-red uppercase">
                {liveConsole.label}
              </span>
              <div className="h-px w-10 bg-accent-red/40" />
            </div>
          </Reveal>

          <div className="flex flex-col gap-6">
            <Reveal delay={0.08}>
              <h2
                id="lc-headline"
                className="font-sans text-[clamp(2.25rem,5vw,4.5rem)] font-black leading-[1.1] tracking-tight text-white"
              >
                {liveConsole.headlinePre}{" "}
                <span className="text-transparent bg-clip-text bg-linear-to-r from-accent-red to-orange-500 font-extrabold">
                  {liveConsole.headlineAccent}
                </span>
              </h2>
            </Reveal>
            <Reveal delay={0.14}>
              <p className="font-sans text-lg text-[#8E8E93] leading-relaxed max-w-[56ch]">
                {liveConsole.thesis}
              </p>
            </Reveal>
          </div>
        </div>

        {/* Console */}
        <Reveal delay={0.2}>
          <div
            onMouseMove={handleMouseMove}
            className="glass-panel bg-white/5 border-white/5 rounded-2xl p-6 md:p-10 spotlight-card"
            style={{ "--mouse-x": `${coords.x}px`, "--mouse-y": `${coords.y}px` } as React.CSSProperties}
          >
            <div className="spotlight-bg" />

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-12">
              {/* LEFT — controls */}
              <div className="flex flex-col gap-8">
                {/* Agent selector */}
                <div className="flex flex-col gap-4">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">
                    Select agent · live on-chain identity
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {agents.map((a) => {
                      const selected = a.agentId === agentId;
                      return (
                        <button
                          key={a.agentId}
                          onClick={() => selectAgent(a.agentId)}
                          className={`group flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all duration-300 ${
                            selected
                              ? "border-accent-red/40 bg-accent-red/5"
                              : "border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/5"
                          }`}
                        >
                          <span className="font-mono text-[11px] text-[#8E8E93]">#{a.agentId}</span>
                          <span
                            className={`font-mono text-2xl font-black tabular-nums ${
                              selected ? "text-white" : "text-[#C7CACE]"
                            }`}
                          >
                            {a.scoreBps}
                          </span>
                          <span className="font-mono text-[9px] uppercase tracking-widest text-[#8E8E93]">
                            bps
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* minScore slider */}
                <div className="flex flex-col gap-4">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">
                      Require min score
                    </span>
                    <span className="font-mono text-2xl font-black text-white tabular-nums">
                      {minScore}
                      <span className="text-[#8E8E93] text-xs font-medium ml-1">bps</span>
                    </span>
                  </div>
                  <input
                    type="range"
                    min={MIN}
                    max={MAX}
                    step={1}
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                    className="w-full accent-[#E6212F] cursor-pointer"
                    aria-label="Minimum trust score"
                  />
                  <div className="flex justify-between font-mono text-[9px] text-[#8E8E93]/60">
                    <span>{MIN}</span>
                    <span>{MAX}</span>
                  </div>
                </div>

                {/* SDK call mirror */}
                <div className="bg-black/50 border border-white/5 rounded-lg p-4 font-mono text-xs text-white/80 overflow-x-auto">
                  <span className="text-[#8E8E93] text-[10px] block mb-3 font-bold uppercase tracking-widest">
                    SDK call
                  </span>
                  <pre className="font-mono text-left leading-relaxed text-xs">
                    <code>
                      <span className="text-orange-400">await</span> trust.
                      <span className="text-yellow-400">gate</span>({"{"}
                      {"\n"}  agentId: <span className="text-cyan-400">{agentId}</span>,
                      {"\n"}  minScore: <span className="text-cyan-400">{minScore}</span>,
                      {"\n"}{"}"}); <span className="text-[#8E8E93]">{`// score ${score} → ${approved ? "settles" : "TrustGateError"}`}</span>
                    </code>
                  </pre>
                </div>
              </div>

              {/* RIGHT — verdict */}
              <div
                className={`flex flex-col justify-between rounded-2xl border p-6 md:p-8 transition-colors duration-500 ${
                  approved
                    ? "border-green-500/25 bg-green-500/[0.04]"
                    : "border-accent-red/25 bg-accent-red/[0.04]"
                }`}
              >
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">
                      Gate decision
                    </span>
                    <span className="relative flex h-2 w-2">
                      <span
                        className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                          approved ? "bg-green-500" : "bg-accent-red"
                        }`}
                      />
                      <span
                        className={`relative inline-flex h-2 w-2 rounded-full ${
                          approved ? "bg-green-500" : "bg-accent-red"
                        }`}
                      />
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span
                      className={`font-sans text-5xl md:text-6xl font-black tracking-tight transition-colors duration-500 ${
                        approved ? "text-green-400" : "text-accent-red"
                      }`}
                    >
                      {approved ? "APPROVED" : "REFUSED"}
                    </span>
                    <span className="font-mono text-sm text-[#8E8E93]">
                      {approved
                        ? "Payment settles on-chain."
                        : "TrustGateError — nothing leaves the wallet."}
                    </span>
                  </div>

                  {/* comparison */}
                  <div className="flex items-center gap-3 font-mono text-lg font-bold tabular-nums pt-2 border-t border-white/5">
                    <span className="text-white">{score}</span>
                    <span className={approved ? "text-green-400" : "text-accent-red"}>
                      {approved ? "≥" : "<"}
                    </span>
                    <span className="text-[#8E8E93]">{minScore}</span>
                    <span className="ml-auto font-sans text-[10px] uppercase tracking-widest text-[#8E8E93]">
                      Agent #{agentId} · {agent.jobsCompleted} jobs
                    </span>
                  </div>
                </div>

                {/* live re-read + proof */}
                <div className="flex flex-col gap-3 mt-8">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={reread}
                      disabled={loading}
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-white transition-all duration-300 hover:border-white/40 hover:bg-white/10 disabled:opacity-50"
                    >
                      <span className={`h-1.5 w-1.5 rounded-full bg-accent-red ${loading ? "animate-ping" : ""}`} />
                      {loading ? "Reading chain…" : "Re-read from chain"}
                    </button>
                    {live && (
                      <span className="font-mono text-[10px] text-green-400">
                        ✓ live @ {live.at}
                      </span>
                    )}
                    {liveError && (
                      <span className="font-mono text-[10px] text-[#8E8E93]">
                        rpc busy — showing last snapshot
                      </span>
                    )}
                  </div>

                  {proof && (
                    <a
                      href={`https://testnet.cspr.live/deploy/${proof.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#8E8E93] hover:text-white transition-colors"
                    >
                      <span className="text-accent-red">↗</span> verify this score on cspr.live
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
