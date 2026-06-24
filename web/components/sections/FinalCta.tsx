import { finalCta } from "@/lib/content";
import { AccentWord } from "@/components/ui/AccentWord";
import { Reveal } from "@/components/motion/Reveal";

export function FinalCta() {
  return (
    <section
      id="final-cta"
      className="w-full bg-bg"
      aria-labelledby="cta-headline"
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-12 py-24 md:py-40 lg:py-[clamp(8rem,16vw,14rem)]">

        {/* Editorial typographic layout — left-anchored, deliberate asymmetry */}
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-[3fr_2fr] lg:gap-24 lg:items-end">

          {/* ── Left: large Zodiak statement ─────────────────────────── */}
          <div className="flex flex-col gap-10">

            <Reveal>
              <h2
                id="cta-headline"
                className="font-display text-[clamp(2.75rem,7vw,6.5rem)] font-semibold leading-[1.0] tracking-[-0.018em] text-text"
              >
                {finalCta.headlineLine1}
                <br />
                {finalCta.headlineLine2Pre}{" "}
                <AccentWord>{finalCta.headlineLine2Accent}</AccentWord>
                {finalCta.headlineLine2Post && (
                  <>{finalCta.headlineLine2Post}</>
                )}
              </h2>
            </Reveal>

            <Reveal delay={0.10}>
              <p className="max-w-[52ch] text-[17px] leading-[1.75] text-muted font-sans">
                {finalCta.body}
              </p>
            </Reveal>

          </div>

          {/* ── Right: typographic links — calm, not a button grid ────── */}
          <Reveal delay={0.16}>
            <div className="flex flex-col gap-6 lg:pb-3">

              <div
                aria-hidden
                className="h-[1px] w-12 hidden lg:block"
                style={{ background: "var(--accent-gold)" }}
              />

              <div className="flex flex-col gap-4">
                <a
                  href="https://www.npmjs.com/package/casper-trust"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-baseline gap-3 font-sans text-[15px] text-text hover:text-muted transition-colors"
                  aria-label="Install casper-trust from npm"
                >
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted group-hover:text-text transition-colors"
                    aria-hidden
                  >
                    npm
                  </span>
                  <span className="underline underline-offset-4 decoration-line group-hover:decoration-text transition-colors">
                    npm install casper-trust
                  </span>
                  <span aria-hidden className="text-muted">↗</span>
                </a>

                <a
                  href="https://github.com/bekirerdem/casper-trust"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-baseline gap-3 font-sans text-[15px] text-text hover:text-muted transition-colors"
                  aria-label="View source on GitHub"
                >
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted group-hover:text-text transition-colors"
                    aria-hidden
                  >
                    src
                  </span>
                  <span className="underline underline-offset-4 decoration-line group-hover:decoration-text transition-colors">
                    github.com/bekirerdem/casper-trust
                  </span>
                  <span aria-hidden className="text-muted">↗</span>
                </a>
              </div>

            </div>
          </Reveal>

        </div>
      </div>
    </section>
  );
}
