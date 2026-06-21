import { loadSnapshot } from "@/lib/data/snapshot";
import { hero } from "@/lib/content";
import { Badge } from "@/components/ui/Badge";
import { CodeBlock } from "@/components/ui/CodeBlock";
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
      {/* very subtle radial glow behind centerpiece — accent, low opacity */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 80% 40%, rgba(43,217,160,0.06) 0%, transparent 70%)",
        }}
      />

      <div className="mx-auto max-w-6xl px-6 py-24 md:px-12 md:py-36">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-12 lg:items-center">

          {/* ── Left column: copy ───────────────────────────────────────── */}
          <div className="flex flex-col gap-8">
            <Reveal>
              <Badge variant="casper">{hero.badge}</Badge>
            </Reveal>

            <Reveal delay={0.08}>
              <h1
                id="hero-headline"
                className="font-display text-5xl font-semibold leading-[1.05] tracking-[-0.03em] text-text md:text-6xl lg:text-7xl whitespace-pre-line"
              >
                {hero.headline}
              </h1>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="max-w-md text-base leading-relaxed text-muted md:text-lg">
                {hero.subhead}
              </p>
            </Reveal>

            <Reveal delay={0.24}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {/* Primary CTA — CodeBlock with copy */}
                <div className="w-full max-w-xs">
                  <CodeBlock code={hero.cta.code} lang={hero.cta.lang} />
                </div>

                {/* Secondary CTA */}
                <a
                  href={hero.secondaryCta.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted hover:text-text transition-colors whitespace-nowrap"
                >
                  {hero.secondaryCta.label}
                </a>
              </div>
            </Reveal>
          </div>

          {/* ── Right column: live visualization ────────────────────────── */}
          <Reveal delay={0.12} className="w-full">
            {/* On mobile (<768px): static — reduced-motion path inside Centerpiece handles it */}
            <Centerpiece data={snapshot} />
          </Reveal>

        </div>
      </div>
    </section>
  );
}
