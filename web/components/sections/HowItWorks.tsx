import { howItWorks } from "@/lib/content";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SplitSection } from "@/components/ui/SplitSection";
import { Reveal } from "@/components/motion/Reveal";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="w-full bg-bg" aria-labelledby="hiw-headline">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12 [padding-block:clamp(6rem,10vw,10rem)]">
        <SplitSection
          ratio="5/7"
          stickyLeft
          left={
            <div className="flex flex-col gap-8">
              <SectionLabel>{howItWorks.label}</SectionLabel>
              <h2
                id="hiw-headline"
                className="font-display text-[clamp(2rem,4vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.015em] text-text max-w-[15ch]"
              >
                {howItWorks.headline}
              </h2>
              {/* sticky step index — stays pinned while the steps scroll on the right */}
              <ol className="mt-2 flex flex-col gap-3 border-t border-line pt-6">
                {howItWorks.steps.map((step) => (
                  <li key={step.number} className="flex items-baseline gap-4">
                    <span className="font-mono text-[11px] tracking-[0.14em] text-accent-red tabular-nums">
                      {step.number}
                    </span>
                    <span className="font-sans text-sm text-muted">{step.title}</span>
                  </li>
                ))}
              </ol>
            </div>
          }
          right={
            <div className="flex flex-col">
              {howItWorks.steps.map((step, i) => (
                <Reveal key={step.number} delay={0.06 + i * 0.08}>
                  <div className="border-t border-line py-12 md:py-16 first:border-t-0 first:pt-0">
                    <span className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase tabular-nums">
                      {step.number}
                    </span>
                    <h3 className="mt-4 font-display text-[clamp(1.75rem,3vw,2.75rem)] font-semibold leading-[1.08] tracking-[-0.012em] text-text">
                      {step.title}
                    </h3>
                    <p className="mt-5 text-[17px] leading-[1.75] text-muted font-sans max-w-[56ch]">
                      {step.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          }
        />
      </div>
    </section>
  );
}
