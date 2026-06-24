import { problem } from "@/lib/content";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AccentWord } from "@/components/ui/AccentWord";
import { Reveal } from "@/components/motion/Reveal";

export function Problem() {
  return (
    <section
      id="problem"
      className="w-full bg-bg"
      aria-labelledby="problem-headline"
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-12 py-24 md:py-36 lg:py-[clamp(6rem,12vw,11rem)]">
        {/* Asymmetric layout: label flush left, headline shifted right on large screens */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_3fr] lg:gap-20 lg:items-start">

          {/* Left: label column */}
          <Reveal>
            <div className="flex flex-col gap-6 lg:pt-3">
              <SectionLabel>{problem.label}</SectionLabel>
              {/* Gold underline ornament */}
              <div
                aria-hidden
                className="h-[1px] w-8"
                style={{ background: "var(--accent-gold)" }}
              />
            </div>
          </Reveal>

          {/* Right: statement column */}
          <div className="flex flex-col gap-10">
            <Reveal delay={0.08}>
              <h2
                id="problem-headline"
                className="font-display text-[clamp(2.5rem,6vw,5.5rem)] font-semibold leading-[1.05] tracking-[-0.015em] text-text"
              >
                {problem.headlinePre}{" "}
                <AccentWord>{problem.headlineAccent}</AccentWord>
                <br className="hidden sm:block" />
                {" "}{problem.headlinePost}
              </h2>
            </Reveal>

            <Reveal delay={0.16}>
              <p className="max-w-[60ch] text-[17px] leading-[1.75] text-muted font-sans">
                {problem.body}
              </p>
            </Reveal>
          </div>

        </div>
      </div>
    </section>
  );
}
