"use client";

import { developer } from "@/lib/content";
import { Reveal } from "@/components/motion/Reveal";
import { useState } from "react";

export function Developer() {
  const [copied, setCopied] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const handleCopy = () => {
    navigator.clipboard.writeText(developer.usageCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const codeLines = [
    <span key="1"><span className="text-[#CF222E]">import</span> {"{"} createTrustClient, getReputation, pay {"}"} <span className="text-[#CF222E]">from</span> <span className="text-[#0A3069]">&quot;casper-trust&quot;</span>;</span>,
    <span key="2" className="text-ink/20"></span>,
    <span key="3"><span className="text-[#CF222E]">const</span> trust = <span className="text-[#8250DF]">createTrustClient</span>(); <span className="text-muted">{"// wallet-free reads"}</span></span>,
    <span key="4" className="text-ink/20"></span>,
    <span key="5" className="text-muted">{"// Read an agent's on-chain reputation"}</span>,
    <span key="6"><span className="text-[#CF222E]">const</span> {"{"} scoreBps {"}"} = <span className="text-[#CF222E]">await</span> <span className="text-[#8250DF]">getReputation</span>(trust, agentId);</span>,
    <span key="7" className="text-ink/20"></span>,
    <span key="8" className="text-muted">{"// Trust-gated x402 — refused before any gas is spent"}</span>,
    <span key="9"><span className="text-[#CF222E]">await</span> <span className="text-[#8250DF]">pay</span>({"{"} ...trust, signer {"}"}, {"{"}</span>,
    <span key="10">{"  "}url: providerEndpoint,</span>,
    <span key="11">{"  "}providerAgentId: agentId,</span>,
    <span key="12">{"  "}minScore: <span className="text-[#0550AE]">100n</span>,</span>,
    <span key="13">
      {"}"});
      <span className="inline-block w-1.5 h-3.5 bg-accent-red ml-1 align-middle animate-pulse" />
    </span>
  ];

  return (
    <section
      id="developer"
      className="relative w-full bg-bg py-24 md:py-36 overflow-hidden"
      aria-labelledby="dev-headline"
    >
      <div className="absolute inset-0 bg-glow-red opacity-30 pointer-events-none z-0" />

      <div className="mx-auto max-w-[1200px] px-6 md:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-12 lg:gap-20 items-center">
          
          {/* Left Column: Copy & Badges */}
          <div className="flex flex-col items-start text-left">
            <Reveal>
              <div className="flex items-center gap-4 mb-6">
                <span className="font-mono text-xs font-bold tracking-[0.2em] text-accent-red uppercase">
                  {developer.label}
                </span>
                <div className="h-px w-10 bg-accent-red/40" />
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <h2
                id="dev-headline"
                className="font-sans text-[clamp(2rem,4.2vw,3.4rem)] font-black leading-[1.05] tracking-[-0.02em] text-ink mb-8"
              >
                {developer.headlinePre}{" "}
                <span className="text-accent-red">{developer.headlineAccent}</span>{" "}
                {developer.headlinePost}
              </h2>
            </Reveal>

            <Reveal delay={0.14}>
              <p className="font-sans text-lg text-muted leading-relaxed max-w-[48ch] mb-10">
                {developer.body}
              </p>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                <a
                  href={developer.npmLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-6 py-3.5 text-xs font-semibold uppercase tracking-widest text-bg bg-accent-red border border-transparent rounded-full hover:bg-ink hover:text-bg transition-all duration-300 hover:scale-105 active:scale-95"
                >
                  NPM Registry
                </a>
                <a
                  href={developer.githubLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-6 py-3.5 text-xs font-semibold uppercase tracking-widest text-ink border border-line hover:border-ink/30 rounded-full hover:bg-ink hover:text-bg transition-all duration-300"
                >
                  GitHub Source
                </a>
              </div>
            </Reveal>
          </div>

          {/* Right Column: Code Terminal */}
          <Reveal delay={0.18} className="w-full">
            <div className="relative">
              {/* Decorative terminal glow */}
              <div className="absolute -inset-1.5 bg-linear-to-r from-accent-red to-orange-500 rounded-xl opacity-[0.06] blur-lg pointer-events-none" />
              
              {/* Terminal Box */}
              <div
                onMouseMove={handleMouseMove}
                className="relative w-full rounded-xl border border-line bg-surface shadow-sm overflow-hidden font-mono text-xs spotlight-card"
                style={{
                  "--mouse-x": `${coords.x}px`,
                  "--mouse-y": `${coords.y}px`,
                } as React.CSSProperties}
              >
                <div className="spotlight-bg" />
                
                {/* Terminal Header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-line bg-subtle relative z-10">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-red-500/80" />
                    <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
                    <span className="h-3 w-3 rounded-full bg-ok/80" />
                  </div>
                  <span className="text-muted text-[10px] uppercase tracking-wider font-bold">
                    usage-example.ts
                  </span>
                  <button
                    onClick={handleCopy}
                    className="text-[10px] text-accent-red hover:text-ink uppercase tracking-wider font-bold transition-colors"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>

                {/* Terminal Content */}
                <div className="py-6 overflow-x-auto leading-relaxed text-ink relative z-10">
                  <div className="flex flex-col min-w-[500px]">
                    {codeLines.map((line, idx) => (
                      <div
                        key={idx}
                        className="flex hover:bg-subtle py-0.5 border-l-2 border-transparent hover:border-accent-red transition-colors group"
                      >
                        <span className="w-10 select-none text-muted/45 group-hover:text-muted text-right pr-4 shrink-0 font-mono text-[10px] pt-0.5">
                          {idx + 1}
                        </span>
                        <pre className="font-mono text-left leading-relaxed text-xs">
                          <code>{line}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </Reveal>

        </div>
      </div>
    </section>
  );
}
