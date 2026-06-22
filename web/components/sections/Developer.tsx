"use client";

import { developer } from "@/lib/content";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AccentWord } from "@/components/ui/AccentWord";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Reveal } from "@/components/motion/Reveal";

export function Developer() {
  return (
    <section
      id="developer"
      className="w-full bg-bg"
      aria-labelledby="dev-headline"
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-12 py-24 md:py-36 lg:py-[clamp(6rem,12vw,11rem)]">

        {/* Asymmetric 2:3 — editorial pitch left, code right */}
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-[2fr_3fr] lg:gap-24 lg:items-start">

          {/* ── Left: pitch column ─────────────────────────────────────── */}
          <div className="flex flex-col gap-10">

            <Reveal>
              <div className="flex flex-col gap-6">
                <SectionLabel>{developer.label}</SectionLabel>
                <div
                  aria-hidden
                  className="h-[1px] w-8"
                  style={{ background: "var(--accent-gold)" }}
                />
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <h2
                id="dev-headline"
                className="font-display text-[clamp(2.25rem,5vw,4.5rem)] font-semibold leading-[1.05] tracking-[-0.015em] text-text"
              >
                {developer.headlinePre}{" "}
                <AccentWord>{developer.headlineAccent}</AccentWord>
                {developer.headlinePost && (
                  <>{" "}{developer.headlinePost}</>
                )}
              </h2>
            </Reveal>

            <Reveal delay={0.14}>
              <p className="max-w-[44ch] text-[17px] leading-[1.75] text-muted font-sans">
                {developer.body}
              </p>
            </Reveal>

            <Reveal delay={0.20}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <a
                  href={developer.npmLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-sans text-[13px] uppercase tracking-[0.10em] text-muted hover:text-text transition-colors underline underline-offset-4 decoration-line hover:decoration-text"
                >
                  npmjs.com/package/casper-trust ↗
                </a>
              </div>
              <div className="mt-3">
                <a
                  href={developer.githubLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-sans text-[13px] uppercase tracking-[0.10em] text-muted hover:text-text transition-colors underline underline-offset-4 decoration-line hover:decoration-text"
                >
                  github.com/bekirerdem/casper-trust ↗
                </a>
              </div>
            </Reveal>

          </div>

          {/* ── Right: code column ──────────────────────────────────────── */}
          <div className="flex flex-col gap-6 lg:pt-2">

            {/* Install */}
            <Reveal delay={0.10}>
              <CodeBlock code={developer.installCode} lang="sh" />
            </Reveal>

            {/* Usage snippet */}
            <Reveal delay={0.18}>
              <CodeBlock code={developer.usageCode} lang="ts" />
            </Reveal>

          </div>

        </div>
      </div>
    </section>
  );
}
