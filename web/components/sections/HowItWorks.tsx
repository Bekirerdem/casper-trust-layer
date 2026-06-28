"use client";

import { useState } from "react";
import { howItWorks } from "@/lib/content";
import { Reveal } from "@/components/motion/Reveal";

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section
      id="how-it-works"
      className="relative w-full bg-bg py-24 md:py-36 overflow-hidden"
      aria-labelledby="hiw-headline"
    >
      <div className="absolute inset-0 bg-glow-red opacity-30 pointer-events-none z-0" />

      <div className="mx-auto max-w-[1200px] px-6 md:px-12 relative z-10">
        
        {/* Section Header */}
        <div className="flex flex-col items-start gap-4 mb-16">
          <span className="font-mono text-xs font-bold tracking-[0.2em] text-accent-red uppercase">
            {howItWorks.label}
          </span>
          <h2
            id="hiw-headline"
            className="font-sans text-[clamp(2rem,5vw,3.75rem)] font-black leading-[1.1] tracking-tight text-white max-w-[28ch]"
          >
            {howItWorks.headline}
          </h2>
        </div>

        {/* Desktop Interactive Accordion (hidden on mobile) */}
        <div className="hidden lg:flex items-stretch gap-4 h-[380px] w-full mt-12">
          {howItWorks.steps.map((step, idx) => {
            const isActive = activeStep === idx;
            return (
              <div
                key={step.number}
                onMouseEnter={() => setActiveStep(idx)}
                className={`relative flex flex-col justify-between p-8 rounded-2xl border transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer group overflow-hidden ${
                  isActive
                    ? "flex-[3] bg-white/10 border-accent-red/40 shadow-xl shadow-accent-red/5"
                    : "flex-1 bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                }`}
              >
                {/* Background glow for active step */}
                {isActive && (
                  <div className="absolute inset-0 bg-linear-to-b from-accent-red/5 to-transparent pointer-events-none" />
                )}

                {isActive ? (
                  <div className="grid grid-cols-2 gap-8 h-full w-full relative z-10">
                    {/* Left Column: Info */}
                    <div className="flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm font-bold tracking-wider text-accent-red">
                            {step.number}
                          </span>
                          <span className="h-1.5 w-1.5 rounded-full bg-accent-red scale-125 shadow-[0_0_8px_#E6212F]" />
                        </div>
                        
                        <div className="mt-8">
                          <h3 className="font-sans text-2xl font-bold tracking-tight text-white mb-4">
                            {step.title}
                          </h3>
                          <p className="font-sans text-sm text-[#8E8E93] leading-relaxed max-w-[36ch]">
                            {step.body}
                          </p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-white/5 flex items-center justify-between mt-auto">
                        <span className="font-mono text-[9px] uppercase tracking-widest text-accent-red font-bold">
                          ACTIVE MECHANISM
                        </span>
                        <span className="font-mono text-xs text-accent-red">→</span>
                      </div>
                    </div>

                    {/* Right Column: Visual Mockup */}
                    <div className="flex items-center justify-center h-full relative">
                      <div className="w-full h-full bg-black/40 border border-white/10 rounded-xl p-6 flex flex-col justify-between relative overflow-hidden backdrop-blur-md">
                        <div className="absolute inset-0 bg-grid opacity-15 pointer-events-none" />
                        
                        {step.number === "01" && (
                          <div className="flex flex-col h-full justify-between">
                            <div className="flex items-center justify-between pb-2 border-b border-white/10">
                              <span className="font-mono text-[9px] text-[#8E8E93] tracking-wider">CASPER DEPLOY</span>
                              <span className="px-2 py-0.5 rounded text-[8px] font-mono tracking-widest text-green-400 bg-green-400/10 border border-green-400/20">SECURED</span>
                            </div>
                            
                            <div className="flex flex-col items-center justify-center my-auto py-2">
                              <svg className="w-12 h-12 text-accent-red animate-pulse mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                              </svg>
                              <span className="font-mono text-[10px] text-white font-bold">Node Identity Registered</span>
                              <span className="font-mono text-[8px] text-[#8E8E93] mt-1 break-all select-all">0x3b8d1a49f50e90c42171cb29fa8c18ea7220268a</span>
                            </div>

                            <div className="flex items-center justify-between text-[8px] font-mono text-[#8E8E93]/60 pt-2 border-t border-white/5">
                              <span>deterministic keys</span>
                              <span>permissionless</span>
                            </div>
                          </div>
                        )}

                        {step.number === "02" && (
                          <div className="flex flex-col h-full justify-between">
                            <div className="flex items-center justify-between pb-2 border-b border-white/10">
                              <span className="font-mono text-[9px] text-[#8E8E93] tracking-wider">ESCROW LEDGER</span>
                              <span className="px-2 py-0.5 rounded text-[8px] font-mono tracking-widest text-accent-red bg-accent-red/10 border border-accent-red/20">LOCKED</span>
                            </div>
                            
                            <div className="flex flex-col justify-center my-auto py-2 gap-3 text-left">
                              <div className="flex justify-between items-center text-[9px]">
                                <span className="text-[#8E8E93]">Client Deposit</span>
                                <span className="text-white font-mono font-bold">15,000 CSPR</span>
                              </div>
                              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-accent-red rounded-full w-[75%] animate-pulse" />
                              </div>
                              <div className="flex justify-between items-center text-[9px]">
                                <span className="text-[#8E8E93]">Payout Target</span>
                                <span className="text-green-400 font-mono font-bold">Verified Agent</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[8px] font-mono text-[#8E8E93]/60 pt-2 border-t border-white/5">
                              <span>escrow settled</span>
                              <span>zero trust required</span>
                            </div>
                          </div>
                        )}

                        {step.number === "03" && (
                          <div className="flex flex-col h-full justify-between">
                            <div className="flex items-center justify-between pb-2 border-b border-white/10">
                              <span className="font-mono text-[9px] text-[#8E8E93] tracking-wider">TRUST RATING</span>
                              <span className="px-2 py-0.5 rounded text-[8px] font-mono tracking-widest text-green-400 bg-green-400/10 border border-green-400/20">EXCELLENT</span>
                            </div>
                            
                            <div className="flex items-center justify-around my-auto py-2">
                              <div className="relative flex items-center justify-center">
                                <svg className="w-16 h-16 transform -rotate-90">
                                  <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="3" className="text-white/5" fill="transparent" />
                                  <circle cx="32" cy="32" r="26" stroke="currentColor" strokeWidth="3.5" className="text-accent-red" fill="transparent" strokeDasharray="163" strokeDashoffset="16" />
                                </svg>
                                <span className="absolute font-mono text-[10px] font-bold text-white">9,850</span>
                              </div>
                              
                              <div className="flex flex-col gap-1 text-left">
                                <span className="font-mono text-[9px] text-[#8E8E93]">Basis Points</span>
                                <span className="font-mono text-[9px] text-green-400">100% Delivery</span>
                                <span className="font-mono text-[9px] text-[#8E8E93]">0 Defaults</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[8px] font-mono text-[#8E8E93]/60 pt-2 border-t border-white/5">
                              <span>objective reputation</span>
                              <span>on-chain telemetry</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col justify-between h-full relative z-10">
                    {/* Card Header: Step Index */}
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm font-bold tracking-wider text-[#8E8E93]">
                        {step.number}
                      </span>
                      <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
                    </div>

                    {/* Card Title */}
                    <div className="mt-8">
                      <h3 className="font-sans text-xl font-bold tracking-tight text-[#8E8E93] group-hover:text-white transition-colors">
                        {step.title}
                      </h3>
                    </div>

                    {/* Bottom ornament */}
                    <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                      <span className="font-mono text-[9px] uppercase tracking-widest text-[#8E8E93]/40 group-hover:text-[#8E8E93]/80 transition-colors">
                        HOVER TO VIEW
                      </span>
                      <span className="font-mono text-xs text-[#8E8E93]">→</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mobile Vertical Stack (hidden on desktop) */}
        <div className="flex lg:hidden flex-col gap-6 mt-12">
          {howItWorks.steps.map((step, idx) => (
            <Reveal key={step.number} delay={idx * 0.08}>
              <div className="glass-panel p-6 rounded-xl border border-white/5 bg-white/5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-accent-red">
                    {step.number}
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-accent-red" />
                </div>
                <h3 className="font-sans text-xl font-bold text-white">
                  {step.title}
                </h3>
                <p className="font-sans text-sm text-[#8E8E93] leading-relaxed mb-2">
                  {step.body}
                </p>

                {/* Mobile Preview Block */}
                <div className="w-full bg-black/40 border border-white/10 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden backdrop-blur-md min-h-[140px]">
                  <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none" />
                  
                  {step.number === "01" && (
                    <div className="flex flex-col h-full justify-between gap-3">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <span className="font-mono text-[9px] text-[#8E8E93] tracking-wider">CASPER DEPLOY</span>
                        <span className="px-2 py-0.5 rounded text-[8px] font-mono tracking-widest text-green-400 bg-green-400/10 border border-green-400/20">SECURED</span>
                      </div>
                      
                      <div className="flex items-center gap-3 py-1">
                        <svg className="w-8 h-8 text-accent-red animate-pulse shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
                        </svg>
                        <div className="flex flex-col min-w-0">
                          <span className="font-mono text-[9px] text-white font-bold">Node Registered</span>
                          <span className="font-mono text-[8px] text-[#8E8E93] truncate">0x3b8d1a49f50e90c42171cb29fa8c18ea7220268a</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {step.number === "02" && (
                    <div className="flex flex-col h-full justify-between gap-3">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <span className="font-mono text-[9px] text-[#8E8E93] tracking-wider">ESCROW LEDGER</span>
                        <span className="px-2 py-0.5 rounded text-[8px] font-mono tracking-widest text-accent-red bg-accent-red/10 border border-accent-red/20">LOCKED</span>
                      </div>
                      
                      <div className="flex flex-col gap-2 py-1">
                        <div className="flex justify-between items-center text-[9px]">
                          <span className="text-[#8E8E93]">Client Deposit</span>
                          <span className="text-white font-mono font-bold">15,000 CSPR</span>
                        </div>
                        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-accent-red rounded-full w-[75%]" />
                        </div>
                      </div>
                    </div>
                  )}

                  {step.number === "03" && (
                    <div className="flex flex-col h-full justify-between gap-3">
                      <div className="flex items-center justify-between pb-2 border-b border-white/10">
                        <span className="font-mono text-[9px] text-[#8E8E93] tracking-wider">TRUST RATING</span>
                        <span className="px-2 py-0.5 rounded text-[8px] font-mono tracking-widest text-green-400 bg-green-400/10 border border-green-400/20">EXCELLENT</span>
                      </div>
                      
                      <div className="flex items-center justify-between py-1">
                        <div className="relative flex items-center justify-center">
                          <svg className="w-12 h-12 transform -rotate-90">
                            <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2.5" className="text-white/5" fill="transparent" />
                            <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="3" className="text-accent-red" fill="transparent" strokeDasharray="113" strokeDashoffset="11" />
                          </svg>
                          <span className="absolute font-mono text-[8px] font-bold text-white">9.8k</span>
                        </div>
                        <div className="flex flex-col gap-0.5 text-right">
                          <span className="font-mono text-[9px] text-green-400">100% Delivery</span>
                          <span className="font-mono text-[8px] text-[#8E8E93]">0 Defaults</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

      </div>
    </section>
  );
}
