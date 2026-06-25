"use client";

import { trustGating } from "@/lib/content";
import { Reveal } from "@/components/motion/Reveal";
import { useState } from "react";

export function TrustGating() {
  const [coordsA, setCoordsA] = useState({ x: 0, y: 0 });
  const [coordsB, setCoordsB] = useState({ x: 0, y: 0 });

  const handleMouseMoveA = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoordsA({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseMoveB = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoordsB({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <section
      id="trust-gating"
      className="relative w-full bg-bg py-24 md:py-36 overflow-hidden"
      aria-labelledby="tg-headline"
    >
      {/* Background glow in center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-glow-red opacity-30 pointer-events-none z-0" />

      <div className="mx-auto max-w-[1200px] px-6 md:px-12 relative z-10">
        
        {/* Section Header */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2.5fr] gap-8 lg:gap-20 items-start mb-16 md:mb-24">
          <Reveal>
            <div className="flex flex-col gap-4">
              <span className="font-mono text-xs font-bold tracking-[0.2em] text-accent-red uppercase">
                {trustGating.label}
              </span>
              <div className="h-px w-10 bg-accent-red/40" />
            </div>
          </Reveal>

          <div className="flex flex-col gap-6">
            <Reveal delay={0.08}>
              <h2
                id="tg-headline"
                className="font-sans text-[clamp(2.25rem,5vw,4.5rem)] font-black leading-[1.1] tracking-tight text-white"
              >
                {trustGating.headlinePre}{" "}
                <span className="text-transparent bg-clip-text bg-linear-to-r from-accent-red to-orange-500 font-extrabold">
                  {trustGating.headlineAccent}
                </span>{" "}
                {trustGating.headlinePost}
              </h2>
            </Reveal>

            <Reveal delay={0.14}>
              <p className="font-sans text-lg text-[#8E8E93] leading-relaxed max-w-[56ch]">
                {trustGating.thesis}
              </p>
            </Reveal>
          </div>
        </div>

        {/* Core Logic Comparison Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mt-12">
          
          {/* Scenario A: REFUSED (Left 5 cols) */}
          <div className="lg:col-span-5 flex">
            <Reveal className="w-full flex" delay={0.2}>
              <div
                onMouseMove={handleMouseMoveA}
                className="w-full glass-panel bg-white/5 border-white/5 rounded-2xl p-8 flex flex-col justify-between opacity-70 hover:opacity-100 transition-opacity duration-300 spotlight-card"
                style={{
                  "--mouse-x": `${coordsA.x}px`,
                  "--mouse-y": `${coordsA.y}px`,
                } as React.CSSProperties}
              >
                <div className="spotlight-bg" />
                <div className="flex flex-col gap-6 relative z-10">
                  {/* Scenario Tag & Border */}
                  <div className="flex items-center justify-between pb-4 border-b border-white/5">
                    <span className="font-mono text-xs text-[#8E8E93] uppercase tracking-widest">
                      {trustGating.scenarioA.tag}
                    </span>
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono tracking-widest text-[#8E8E93] bg-white/5 border border-white/10 uppercase">
                      REFUSED
                    </span>
                  </div>

                  {/* Scenario Status */}
                  <h3 className="font-sans text-3xl font-bold text-white tracking-tight leading-tight">
                    {trustGating.scenarioA.status}{" "}
                    <span className="text-[#8E8E93] line-through decoration-accent-red">
                      {trustGating.scenarioA.statusAccent}
                    </span>
                  </h3>

                  {/* Parameters Grid */}
                  <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/5">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs text-[#8E8E93]">minScore</span>
                      <span className="font-mono text-xl font-bold text-white mt-1">{trustGating.scenarioA.minScore}</span>
                    </div>
                    <div className="flex flex-col border-l border-white/5 pl-4">
                      <span className="font-mono text-xs text-[#8E8E93]">agentScore</span>
                      <span className="font-mono text-xl font-bold text-accent-red mt-1">{trustGating.scenarioA.agentScore}</span>
                    </div>
                  </div>
                </div>

                {/* Error Console block */}
                <div className="mt-8 flex flex-col gap-3 relative z-10">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-accent-red font-bold">
                    Console Exception
                  </span>
                  <div className="bg-black/50 border border-accent-red/20 rounded p-4 font-mono text-xs text-accent-red/80">
                    {trustGating.scenarioA.error}
                  </div>
                  <p className="font-sans text-xs text-[#8E8E93] mt-2">
                    {trustGating.scenarioA.note}
                  </p>
                </div>
              </div>
            </Reveal>
          </div>

          {/* Scenario B: PAID (Right 7 cols - Dominant) */}
          <div className="lg:col-span-7 flex">
            <Reveal className="w-full flex" delay={0.28}>
              <div
                onMouseMove={handleMouseMoveB}
                className="w-full glass-panel bg-white/5 border-accent-red/20 rounded-2xl p-8 flex flex-col justify-between relative shadow-xl shadow-accent-red/5 spotlight-card"
                style={{
                  "--mouse-x": `${coordsB.x}px`,
                  "--mouse-y": `${coordsB.y}px`,
                } as React.CSSProperties}
              >
                <div className="spotlight-bg" />
                {/* Visual active ribbon */}
                <div className="absolute top-0 right-8 transform -translate-y-1/2 bg-accent-red text-white text-[9px] font-mono tracking-widest uppercase px-3 py-1 rounded-full shadow-lg shadow-accent-red/30 z-20">
                  TRUST VERIFIED
                </div>

                <div className="flex flex-col gap-6 relative z-10">
                  {/* Scenario Tag & Border */}
                  <div className="flex items-center justify-between pb-4 border-b border-white/5">
                    <span className="font-mono text-xs text-[#8E8E93] uppercase tracking-widest">
                      {trustGating.scenarioB.tag}
                    </span>
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                    </span>
                  </div>

                  {/* Scenario Status */}
                  <h3 className="font-sans text-3xl font-bold text-white tracking-tight leading-tight">
                    {trustGating.scenarioB.status}
                  </h3>

                  {/* Parameters Grid */}
                  <div className="grid grid-cols-2 gap-4 py-4 border-y border-white/5">
                    <div className="flex flex-col">
                      <span className="font-mono text-xs text-[#8E8E93]">minScore</span>
                      <span className="font-mono text-xl font-bold text-white mt-1">{trustGating.scenarioB.minScore}</span>
                    </div>
                    <div className="flex flex-col border-l border-white/5 pl-4">
                      <span className="font-mono text-xs text-[#8E8E93]">agentScore</span>
                      <span className="font-mono text-xl font-bold text-green-400 mt-1">{trustGating.scenarioB.agentScore}</span>
                    </div>
                  </div>
                </div>

                {/* Outcome & Code Snippet */}
                <div className="mt-8 flex flex-col gap-4 relative z-10">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-[#8E8E93]">
                      On-Chain Event
                    </span>
                    <span className="text-[10px] font-mono text-green-400 font-bold uppercase">
                      {trustGating.scenarioB.result}
                    </span>
                  </div>
                  
                  <div className="bg-black/50 border border-white/5 rounded-lg p-4 font-mono text-xs text-white/80 overflow-x-auto">
                    <span className="text-[#8E8E93] text-[10px] block mb-3 font-bold uppercase tracking-widest">API Call</span>
                    <pre className="font-mono text-left leading-relaxed text-xs">
                      <code>
                        <span className="text-orange-400">const</span> gate = <span className="text-orange-400">await</span> trust.<span className="text-yellow-400">gate</span>({"{"}
                        {"\n"}  agentId: <span className="text-cyan-400">0</span>,
                        {"\n"}  minScore: <span className="text-cyan-400">100</span>, <span className="text-[#8E8E93]">{"// \u2190 the only variable"}</span>
                        {"\n"}{"}"});
                        {"\n"}<span className="text-[#8E8E93]">{"// score 100 \u2192 settles"}</span>
                        {"\n"}<span className="text-[#8E8E93]">{"// score  99 \u2192 TrustGateError"}</span>
                      </code>
                    </pre>
                  </div>
                  
                  <p className="font-sans text-xs text-[#8E8E93]">
                    {trustGating.scenarioB.note}
                  </p>
                </div>
              </div>
            </Reveal>
          </div>

        </div>

      </div>
    </section>
  );
}
