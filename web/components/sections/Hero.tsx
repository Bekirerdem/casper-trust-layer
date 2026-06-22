import { loadSnapshot } from "@/lib/data/snapshot";
import { hero } from "@/lib/content";
import { Badge } from "@/components/ui/Badge";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AccentWord } from "@/components/ui/AccentWord";
import { Divider } from "@/components/ui/Divider";
import { Reveal } from "@/components/motion/Reveal";
import { Centerpiece } from "@/components/sections/Centerpiece";

export function Hero() {
  const snapshot = loadSnapshot();

  return (
    <section
      id="hero"
      className="relative w-full overflow-hidden bg-bg"
      aria-labelledby="hero-headline"
    >
      {/* Top Divider — 1px red signature line */}
      <Divider />

      <div className="mx-auto max-w-[1200px] px-6 md:px-12 py-20 md:py-32 lg:py-40">
        {/* Asymmetric 3:5 grid — left heavier, right narrower */}
        <div className="grid grid-cols-1 gap-20 lg:grid-cols-[3fr_2fr] lg:gap-16 lg:items-start">

          {/* ── Left column: editorial copy ─────────────────────────────── */}
          <div className="flex flex-col gap-10">

            <Reveal>
              <div className="flex items-center gap-4">
                <SectionLabel>{hero.label}</SectionLabel>
                <div className="h-px flex-1 bg-line" aria-hidden />
              </div>
            </Reveal>

            <Reveal delay={0.08}>
              <h1
                id="hero-headline"
                className="font-display text-[clamp(3rem,8vw,7.5rem)] font-semibold leading-[1.0] tracking-[-0.015em] text-text"
              >
                {hero.headlinePre}{" "}
                <AccentWord>{hero.headlineAccent}</AccentWord>
                <br />
                {hero.headlinePost}
              </h1>
            </Reveal>

            <Reveal delay={0.14}>
              {/* Gold underline mark — ~48px, thin, under subhead only */}
              <div className="flex flex-col gap-3">
                <p className="max-w-[52ch] text-[17px] leading-[1.75] text-muted font-sans">
                  {hero.subhead}
                </p>
                <div
                  aria-hidden
                  className="h-[2px] w-12"
                  style={{ background: "var(--accent-gold)" }}
                />
              </div>
            </Reveal>

            <Reveal delay={0.22}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="w-full max-w-[18rem]">
                  <CodeBlock code={hero.cta.code} lang={hero.cta.lang} />
                </div>
                <a
                  href={hero.secondaryCta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted hover:text-text transition-colors whitespace-nowrap font-sans"
                >
                  {hero.secondaryCta.label}
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.28}>
              <Badge variant="casper">{hero.badge}</Badge>
            </Reveal>

          </div>

          {/* ── Right column: editorial centerpiece ─────────────────────── */}
          <Reveal delay={0.18} className="w-full lg:pt-4">
            <Centerpiece data={snapshot} />
          </Reveal>

        </div>
      </div>

      {/* Bottom Divider */}
      <Divider />
    </section>
  );
}
