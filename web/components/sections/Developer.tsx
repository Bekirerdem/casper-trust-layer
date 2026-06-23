"use client";

import { developer } from "@/lib/content";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AccentWord } from "@/components/ui/AccentWord";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { BentoGrid, BentoCell } from "@/components/ui/BentoGrid";
import { Reveal } from "@/components/motion/Reveal";

export function Developer() {
  return (
    <section id="developer" className="w-full bg-bg" aria-labelledby="dev-headline">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12 [padding-block:clamp(6rem,10vw,10rem)]">

        <BentoGrid>
          {/* Pitch — tall cell spanning both code rows */}
          <Reveal>
            <BentoCell
              span="md:col-span-1 md:row-span-2"
              className="flex flex-col justify-between min-h-[300px]"
            >
              <SectionLabel>{developer.label}</SectionLabel>
              <div>
                <h2
                  id="dev-headline"
                  className="font-display text-[clamp(2rem,3.5vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.015em] text-text"
                >
                  {developer.headlinePre} <AccentWord>{developer.headlineAccent}</AccentWord>
                  {developer.headlinePost && <>{" "}{developer.headlinePost}</>}
                </h2>
                <p className="mt-5 max-w-[40ch] text-[16px] leading-[1.7] text-muted font-sans">
                  {developer.body}
                </p>
              </div>
            </BentoCell>
          </Reveal>

          {/* Install — wide cell */}
          <Reveal delay={0.08}>
            <BentoCell span="md:col-span-2" className="!p-0">
              <CodeBlock code={developer.installCode} lang="sh" />
            </BentoCell>
          </Reveal>

          {/* Usage — wide cell */}
          <Reveal delay={0.14}>
            <BentoCell span="md:col-span-2" className="!p-0">
              <CodeBlock code={developer.usageCode} lang="ts" />
            </BentoCell>
          </Reveal>
        </BentoGrid>

        {/* Links */}
        <Reveal delay={0.2}>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-10">
            <a
              href={developer.npmLink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-[13px] uppercase tracking-[0.10em] text-muted hover:text-text transition-colors underline underline-offset-4 decoration-line hover:decoration-text"
            >
              npmjs.com/package/casper-trust ↗
            </a>
            <a
              href={developer.githubLink}
              target="_blank"
              rel="noopener noreferrer"
              className="font-sans text-[13px] uppercase tracking-[0.10em] text-muted hover:text-text transition-colors underline underline-offset-4 decoration-line hover:decoration-text"
            >
              github.com/Bekirerdem/casper-trust-layer ↗
            </a>
          </div>
        </Reveal>

      </div>
    </section>
  );
}
