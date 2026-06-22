import { howItWorks } from "@/lib/content";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Reveal } from "@/components/motion/Reveal";

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="w-full bg-bg"
      aria-labelledby="hiw-headline"
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-12 py-24 md:py-36 lg:py-[clamp(6rem,12vw,11rem)]">

        {/* Section header */}
        <Reveal>
          <div className="flex flex-col gap-6 mb-16 md:mb-24">
            <SectionLabel>{howItWorks.label}</SectionLabel>
            <h2
              id="hiw-headline"
              className="font-display text-[clamp(1.75rem,3.5vw,3rem)] font-semibold leading-[1.1] tracking-[-0.012em] text-text max-w-[42ch]"
            >
              {howItWorks.headline}
            </h2>
          </div>
        </Reveal>

        {/* Steps */}
        <div className="flex flex-col">
          {howItWorks.steps.map((step, i) => (
            <Reveal key={step.number} delay={0.08 + i * 0.1}>
              <div>
                {/* Hairline divider above each step */}
                <div className="w-full h-px border-t border-line" aria-hidden />

                {/* Asymmetric 2:3 grid — number+title left, description right */}
                <div className="grid grid-cols-1 gap-6 py-10 md:py-12 lg:grid-cols-[2fr_3fr] lg:gap-16 lg:items-start">

                  {/* Left: number token + title */}
                  <div className="flex flex-col gap-3">
                    <span
                      className="font-mono text-xs tracking-[0.10em] text-muted uppercase"
                      aria-hidden
                    >
                      {step.number}
                    </span>
                    <h3 className="font-display text-[clamp(1.5rem,2.5vw,2.25rem)] font-semibold leading-[1.1] tracking-[-0.010em] text-text">
                      {step.title}
                    </h3>
                  </div>

                  {/* Right: description */}
                  <p className="text-[17px] leading-[1.75] text-muted font-sans max-w-[58ch] lg:pt-1">
                    {step.body}
                  </p>

                </div>
              </div>
            </Reveal>
          ))}

          {/* Closing hairline */}
          <div className="w-full h-px border-t border-line" aria-hidden />
        </div>

      </div>
    </section>
  );
}
