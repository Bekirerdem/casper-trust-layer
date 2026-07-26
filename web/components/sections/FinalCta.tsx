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
        <div className="relative glass-panel rounded-2xl bg-surface border border-line p-8 md:p-16 overflow-hidden shadow-2xl">
          {/* Accent red neon ribbon border top */}
          <div className="absolute top-0 left-0 w-full h-[3px] bg-linear-to-r from-transparent via-accent-red to-transparent" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left copy (7 cols) */}
            <div className="lg:col-span-8 flex flex-col items-start text-left">
              <Reveal>
                <h2
                  id="cta-headline"
                  className="font-sans text-[clamp(2.25rem,5vw,4.5rem)] font-black leading-[1.05] tracking-tight text-ink mb-6"
                >
                  {finalCta.headlineLine1}
                  <br />
                  {finalCta.headlineLine2Pre}{" "}
                  <span className="text-accent-red font-extrabold">
                    {finalCta.headlineLine2Accent}
                  </span>
                  {finalCta.headlineLine2Post}
                </h2>
              </Reveal>

              <Reveal delay={0.1}>
                <p className="font-sans text-base md:text-lg text-muted leading-relaxed max-w-[48ch]">
                  {finalCta.body}
                </p>
              </Reveal>
            </div>

            {/* Right: two doors, one per persona (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4 w-full justify-center">
              <Reveal delay={0.16} className="w-full flex flex-col gap-3">
                {finalCta.doors.map((door) => (
                  <a
                    key={door.href}
                    href={door.href}
                    {...(door.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    className={`flex flex-col gap-1.5 w-full px-6 py-4 rounded-xl transition-all duration-300 hover:scale-102 group ${
                      door.primary
                        ? "bg-accent-red hover:bg-ink text-bg shadow-lg shadow-accent-red/10"
                        : "bg-surface hover:bg-subtle border border-line hover:border-ink/25 text-ink"
                    }`}
                  >
                    {/* On the red card the type stays light through the hover —
                        it darkens to ink, so anything ink-coloured disappears. */}
                    <span className={`font-mono text-[9px] uppercase tracking-[0.2em] ${door.primary ? "text-bg/75" : "text-accent-red"}`}>
                      {door.audience}
                    </span>
                    <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-widest">
                      <span>{door.title}</span>
                      <span className="font-mono text-sm transform group-hover:translate-x-0.5 transition-transform">↗</span>
                    </span>
                    <span className={`font-sans text-xs normal-case tracking-normal ${door.primary ? "text-bg/75" : "text-muted"}`}>
                      {door.body}
                    </span>
                  </a>
                ))}
                <a
                  href={finalCta.tertiaryLink.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-start font-mono text-[10px] text-muted hover:text-ink transition-colors mt-1"
                >
                  {finalCta.tertiaryLink.label}
                </a>
              </Reveal>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
}
