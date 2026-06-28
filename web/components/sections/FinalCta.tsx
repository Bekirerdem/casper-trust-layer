"use client";

import { finalCta } from "@/lib/content";
import { Reveal } from "@/components/motion/Reveal";

export function FinalCta() {
  return (
    <section
      id="final-cta"
      className="relative w-full bg-bg py-20 md:py-32 overflow-hidden"
      aria-labelledby="cta-headline"
    >
      <div className="absolute inset-0 bg-glow-red opacity-30 pointer-events-none z-0" />

      <div className="mx-auto max-w-[1200px] px-6 md:px-12 relative z-10">
        
        {/* Glowing glassmorphic panel */}
        <div className="relative glass-panel rounded-2xl bg-white/5 border border-white/10 p-8 md:p-16 overflow-hidden shadow-2xl">
          {/* Accent red neon ribbon border top */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-linear-to-r from-transparent via-accent-red to-transparent" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left copy (7 cols) */}
            <div className="lg:col-span-8 flex flex-col items-start text-left">
              <Reveal>
                <h2
                  id="cta-headline"
                  className="font-sans text-[clamp(2.25rem,5vw,4.5rem)] font-black leading-[1.05] tracking-tight text-white mb-6"
                >
                  {finalCta.headlineLine1}
                  <br />
                  {finalCta.headlineLine2Pre}{" "}
                  <span className="text-transparent bg-clip-text bg-linear-to-r from-accent-red to-orange-500 font-extrabold">
                    {finalCta.headlineLine2Accent}
                  </span>
                  {finalCta.headlineLine2Post}
                </h2>
              </Reveal>

              <Reveal delay={0.1}>
                <p className="font-sans text-base md:text-lg text-[#8E8E93] leading-relaxed max-w-[48ch]">
                  {finalCta.body}
                </p>
              </Reveal>
            </div>

            {/* Right CTAs (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4 w-full justify-center">
              <Reveal delay={0.16} className="w-full flex flex-col gap-3">
                <a
                  href="https://www.npmjs.com/package/casper-trust"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-between w-full px-6 py-4 bg-accent-red hover:bg-white hover:text-black rounded-xl text-xs font-semibold uppercase tracking-widest text-white transition-all duration-300 hover:scale-102 shadow-lg shadow-accent-red/10 group"
                >
                  <span>Install from NPM</span>
                  <span className="font-mono text-sm transform group-hover:translate-x-0.5 transition-transform">↗</span>
                </a>
                
                <a
                  href="https://github.com/Bekirerdem/casper-trust-layer"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-between w-full px-6 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white rounded-xl text-xs font-semibold uppercase tracking-widest text-white transition-all duration-300 hover:scale-102 group"
                >
                  <span>GitHub Repository</span>
                  <span className="font-mono text-sm transform group-hover:translate-x-0.5 transition-transform">↗</span>
                </a>
              </Reveal>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
