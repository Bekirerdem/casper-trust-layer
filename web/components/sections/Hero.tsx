"use client";

import { loadSnapshot } from "@/lib/data/snapshot";
import { hero } from "@/lib/content";
import { Reveal } from "@/components/motion/Reveal";
import { Centerpiece } from "@/components/sections/Centerpiece";
import { HeroCanvas } from "@/components/sections/HeroCanvas";
import { useState, useEffect, useRef } from "react";

export function Hero() {
  const snapshot = loadSnapshot();
  const [copied, setCopied] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(hero.cta.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const x = (e.clientX - centerX) / centerX; // -1 to 1
    const y = (e.clientY - centerY) / centerY; // -1 to 1
    setParallax({ x, y });
  };

  const handleHeroMouseLeave = () => {
    setParallax({ x: 0, y: 0 });
  };

  // Start automatic slideshow timer
  useEffect(() => {
    const startTimer = () => {
      timerRef.current = setInterval(() => {
        setActiveSlide((prev) => (prev + 1) % 3);
      }, 6000);
    };

    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const selectSlide = (idx: number) => {
    setActiveSlide(idx);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setActiveSlide((prev) => (prev + 1) % 3);
      }, 6000);
    }
  };

  return (
    <section
      id="hero"
      onMouseMove={handleHeroMouseMove}
      onMouseLeave={handleHeroMouseLeave}
      className="relative w-full overflow-hidden bg-[#08080A] py-16 md:py-24 lg:py-32"
      style={{
        "--parallax-x": parallax.x,
        "--parallax-y": parallax.y,
      } as React.CSSProperties}
      aria-labelledby="hero-headline"
    >
      {/* Volumetric Aurora Backdrop Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
        {/* Animated Aurora Volumetric Clouds */}
        <div 
          className="absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] opacity-45 filter blur-[100px] md:blur-[140px]"
          style={{
            transform: "translate(calc(var(--parallax-x) * -35px), calc(var(--parallax-y) * -35px)) scale(1.1)",
          }}
        >
          {/* Cloud 1: Deep Red */}
          <div className="absolute -top-1/4 -left-1/4 w-[75vw] h-[75vw] rounded-full bg-accent-red/20 mix-blend-screen animate-[float-slow-1_25s_infinite_ease-in-out]" />
          
          {/* Cloud 2: Crimson/Burgundy */}
          <div className="absolute -bottom-1/4 -right-1/4 w-[65vw] h-[65vw] rounded-full bg-red-950/30 mix-blend-screen animate-[float-slow-2_30s_infinite_ease-in-out]" />
          
          {/* Cloud 3: Purple/Maroon */}
          <div className="absolute top-1/3 left-1/3 w-[55vw] h-[55vw] rounded-full bg-rose-950/20 mix-blend-screen animate-[float-slow-3_20s_infinite_ease-in-out]" />
        </div>

        {/* Faint Particle Canvas in background layer */}
        <div className="absolute inset-0 opacity-15 mix-blend-screen">
          <HeroCanvas />
        </div>

        {/* Vignette Overlay */}
        <div className="vignette-overlay" />

        {/* Local Film Grain Overlay for extra texture depth in hero */}
        <div className="film-grain opacity-40 mix-blend-overlay" />
      </div>

      <div className="mx-auto max-w-[1200px] px-6 md:px-12 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-16 lg:gap-12 items-center">
          
          {/* Left Column: Heading & Copy */}
          <div 
            className="flex flex-col items-start text-left reveal-fade-in transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              transform: "translate(calc(var(--parallax-x) * 12px), calc(var(--parallax-y) * 12px))",
            }}
          >
            <Reveal>
              <div className="inline-flex items-center gap-2 mb-6">
                <span className="font-mono text-xs font-bold tracking-[0.2em] text-accent-red uppercase">
                  {hero.label}
                </span>
                <span className="h-px w-8 bg-white/20" />
                <span className="font-sans text-xs tracking-widest text-[#8E8E93] uppercase">
                  {hero.badge}
                </span>
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <h1
                id="hero-headline"
                className="font-sans text-[clamp(2.75rem,7vw,5.5rem)] font-black leading-[1.05] tracking-tight text-white mb-8"
              >
                {hero.headlinePre}{" "}
                <span className="relative inline-block text-transparent bg-clip-text bg-linear-to-r from-accent-red via-red-500 to-orange-500 font-extrabold filter drop-shadow-[0_2px_15px_rgba(230,33,47,0.2)] animate-pulse">
                  {hero.headlineAccent}
                </span>
                <br className="hidden md:block" />
                {" "}{hero.headlinePost}
              </h1>
            </Reveal>

            <Reveal delay={0.14}>
              <p className="font-sans text-lg md:text-xl text-[#8E8E93] leading-relaxed max-w-[50ch] mb-10">
                {hero.subhead}
              </p>
            </Reveal>

            <Reveal delay={0.22}>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                {/* Custom Code Copy Button - Premium pill */}
                <button
                  onClick={handleCopy}
                  className="flex items-center justify-between gap-4 px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full transition-all duration-300 group font-mono text-xs text-white"
                >
                  <span className="text-accent-red font-bold">$</span>
                  <span>{hero.cta.code}</span>
                  <span className="text-[10px] uppercase tracking-wider text-[#8E8E93] group-hover:text-white transition-colors pl-4 border-l border-white/10">
                    {copied ? "Copied" : "Copy"}
                  </span>
                </button>

                {/* Secondary CTA - Outlined button */}
                <a
                  href={hero.secondaryCta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-6 py-3.5 text-xs font-semibold uppercase tracking-widest text-white border border-white/20 hover:border-white rounded-full hover:bg-white hover:text-black transition-all duration-300"
                >
                  {hero.secondaryCta.label}
                </a>
              </div>
            </Reveal>
          </div>

          {/* Right Column: Sliding Cinematic Showcase */}
          <div 
            className="w-full relative z-10 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              transform: "translate(calc(var(--parallax-x) * -15px), calc(var(--parallax-y) * -15px))",
            }}
          >
            {/* Decorative glows behind Centerpiece */}
            <div className="absolute -inset-2 bg-linear-to-r from-accent-red to-orange-500 rounded-2xl opacity-10 blur-xl pointer-events-none" />
            
            {/* Main Showcase Panel */}
            <div
              onMouseMove={handleMouseMove}
              className="relative glass-panel rounded-2xl p-6 border border-white/10 shadow-2xl spotlight-card h-[430px] flex flex-col justify-between"
              style={{
                "--mouse-x": `${coords.x}px`,
                "--mouse-y": `${coords.y}px`,
              } as React.CSSProperties}
            >
              <div className="spotlight-bg" />

              {/* Slider Content Wrapper */}
              <div className="w-full h-full overflow-hidden relative">
                
                {/* Slide 1: Reputation Ticker (Centerpiece) */}
                <div
                  className={`absolute inset-0 transition-all duration-500 ease-in-out ${
                    activeSlide === 0 ? "opacity-100 translate-x-0 scale-100 z-10" : "opacity-0 translate-x-12 scale-95 pointer-events-none z-0"
                  }`}
                >
                  <Centerpiece data={snapshot} />
                </div>

                {/* Slide 2: Escrow Ledger Visuals */}
                <div
                  className={`absolute inset-0 transition-all duration-500 ease-in-out flex flex-col justify-between ${
                    activeSlide === 1 ? "opacity-100 translate-x-0 scale-100 z-10" : "opacity-0 translate-x-12 scale-95 pointer-events-none z-0"
                  }`}
                >
                  <div className="flex flex-col gap-6 text-left">
                    <div className="flex items-center justify-between pb-4 border-b border-white/10">
                      <span className="font-mono text-xs uppercase tracking-widest text-[#8E8E93]">
                        On-Chain Escrow Ledger
                      </span>
                      <span className="font-mono text-[9px] text-[#8E8E93]/60">
                        CONTRACT STATUS
                      </span>
                    </div>

                    <div className="flex flex-col gap-4 py-2">
                      <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                        <span className="font-mono text-xs text-[#8E8E93]">Escrow Hash</span>
                        <span className="font-mono text-xs text-white">0x07f18a2...c421</span>
                      </div>
                      <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                        <span className="font-mono text-xs text-[#8E8E93]">Funds Locked</span>
                        <span className="font-mono text-xs text-green-400 font-bold">12,500 CSPR</span>
                      </div>
                      <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                        <span className="font-mono text-xs text-[#8E8E93]">Provider Address</span>
                        <span className="font-mono text-xs text-[#8E8E93]">0xca52d...99b0</span>
                      </div>
                    </div>

                    <div className="bg-black/40 border border-white/5 rounded-lg p-4 font-mono text-[11px] leading-relaxed text-[#8E8E93]">
                      <span className="text-white font-bold block mb-1">State: SECURED</span>
                      Funds are programmatically locked in the Casper Escrow client. On job delivery, Casper Trust Layer auto-releases payment and triggers on-chain score shifts.
                    </div>
                  </div>

                  <div className="w-full flex items-center justify-between font-mono text-[10px] text-[#8E8E93]/60 pt-4">
                    <span>ledger status: verified</span>
                    <span>100% SECURE</span>
                  </div>
                </div>

                {/* Slide 3: Identity Verification Visuals */}
                <div
                  className={`absolute inset-0 transition-all duration-500 ease-in-out flex flex-col justify-between ${
                    activeSlide === 2 ? "opacity-100 translate-x-0 scale-100 z-10" : "opacity-0 translate-x-12 scale-95 pointer-events-none z-0"
                  }`}
                >
                  <div className="flex flex-col gap-6 text-left">
                    <div className="flex items-center justify-between pb-4 border-b border-white/10">
                      <span className="font-mono text-xs uppercase tracking-widest text-[#8E8E93]">
                        Agent Identity Registry
                      </span>
                      <span className="font-mono text-[9px] text-[#8E8E93]/60 animate-pulse">
                        BLOCK INTEGRITY
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 bg-black/40 border border-white/5 rounded-lg p-4 font-mono text-[11px] leading-relaxed">
                      <div className="flex items-center justify-between text-green-400 border-b border-white/5 pb-1.5 mb-1.5">
                        <span>Agent Key Signature</span>
                        <span>0x23ea...f1b2</span>
                      </div>
                      <p className="text-[#8E8E93]">
                        The Casper Trust Registry binds cryptographic public keys to Agent nodes. No centralized verification needed—deterministic trust computed directly on-chain.
                      </p>
                    </div>

                    <div className="flex items-center gap-4 py-2 border-t border-white/5 mt-2">
                      <div className="flex-1 p-3 bg-white/5 border border-white/5 rounded-lg text-center flex flex-col">
                        <span className="font-mono text-xl font-bold text-white">4</span>
                        <span className="text-[9px] uppercase tracking-wider text-[#8E8E93]">Verified Nodes</span>
                      </div>
                      <div className="flex-1 p-3 bg-white/5 border border-white/5 rounded-lg text-center flex flex-col">
                        <span className="font-mono text-xl font-bold text-accent-red">0</span>
                        <span className="text-[9px] uppercase tracking-wider text-[#8E8E93]">Default Rates</span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full flex items-center justify-between font-mono text-[10px] text-[#8E8E93]/60 pt-4">
                    <span>registry status: synced</span>
                    <span>99.9% UPTIME</span>
                  </div>
                </div>

              </div>

              {/* Slider Bottom Navigation & Progress Bars */}
              <div className="flex items-center justify-between pt-6 border-t border-white/10 z-10">
                <div className="flex items-center gap-3">
                  {[0, 1, 2].map((idx) => (
                    <button
                      key={idx}
                      onClick={() => selectSlide(idx)}
                      className={`flex flex-col items-start gap-1 text-left group transition-all`}
                    >
                      <span
                        className={`font-mono text-xs font-bold transition-colors ${
                          activeSlide === idx ? "text-accent-red" : "text-[#8E8E93]/40 group-hover:text-[#8E8E93]"
                        }`}
                      >
                        0{idx + 1}
                      </span>
                      {/* Interactive Progress Line */}
                      <div className="w-12 h-0.5 bg-white/10 rounded overflow-hidden">
                        <div
                          className={`h-full bg-accent-red rounded transition-all duration-300 ${
                            activeSlide === idx ? "w-full animate-slide-progress" : "w-0"
                          }`}
                          style={{
                            animationDuration: activeSlide === idx ? "6s" : "0s",
                          }}
                        />
                      </div>
                    </button>
                  ))}
                </div>

                <span className="font-mono text-[9px] uppercase tracking-widest text-[#8E8E93]/40">
                  REAL-TIME TELEMETRY
                </span>
              </div>

            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
