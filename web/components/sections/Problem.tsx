"use client";

import { problem } from "@/lib/content";
import { Reveal } from "@/components/motion/Reveal";

export function Problem() {
  return (
    <section
      id="problem"
      className="relative w-full bg-bg overflow-hidden py-24 md:py-36"
      aria-labelledby="problem-headline"
    >
      {/* Glow background ornament behind the section */}
      <div className="absolute inset-0 bg-glow-red opacity-50 pointer-events-none z-0" />

      <div className="mx-auto max-w-[1200px] px-6 md:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2.5fr] gap-12 lg:gap-20 items-start">
          
          {/* Left Column: Number & Section Tag */}
          <Reveal>
            <div className="flex flex-col gap-4">
              <span className="font-mono text-xs font-bold tracking-[0.2em] text-accent-red uppercase">
                {problem.label}
              </span>
              <div className="h-px w-10 bg-accent-red/40" />
            </div>
          </Reveal>

          {/* Right Column: Statement & Details */}
          <div className="flex flex-col gap-8">
            <Reveal delay={0.08}>
              <h2
                id="problem-headline"
                className="font-sans text-[clamp(2.25rem,5vw,4.5rem)] font-black leading-[1.1] tracking-tight text-white"
              >
                {problem.headlinePre}{" "}
                <span className="text-transparent bg-clip-text bg-linear-to-r from-accent-red to-orange-500 font-extrabold">
                  {problem.headlineAccent}
                </span>{" "}
                {problem.headlinePost}
              </h2>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="font-sans text-lg md:text-xl text-[#8E8E93] leading-relaxed max-w-[54ch]">
                {problem.body}
              </p>
            </Reveal>

            {/* Micro details or stats cards beneath the statement */}
            <Reveal delay={0.22}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                <div className="glass-panel p-6 rounded-xl border border-white/5 bg-white/5 flex flex-col gap-2">
                  <span className="font-mono text-xs text-accent-red font-bold uppercase tracking-wider">The Status Quo</span>
                  <p className="font-sans text-sm text-[#8E8E93]">
                    AI agents rely on centralized APIs and self-asserted metadata to establish reputation. Easily spoofed, impossible to verify.
                  </p>
                </div>
                <div className="glass-panel p-6 rounded-xl border border-white/5 bg-white/5 flex flex-col gap-2">
                  <span className="font-mono text-xs text-green-400 font-bold uppercase tracking-wider">The Trust Solution</span>
                  <p className="font-sans text-sm text-[#8E8E93]">
                    Every interaction locks funds in escrow. Completed jobs prove value on-chain, automatically updating reputation scores.
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
