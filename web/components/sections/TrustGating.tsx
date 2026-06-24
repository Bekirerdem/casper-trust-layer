import { trustGating } from "@/lib/content";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AccentWord } from "@/components/ui/AccentWord";
import { Reveal } from "@/components/motion/Reveal";

export function TrustGating() {
  return (
    <section
      id="trust-gating"
      className="w-full bg-bg"
      aria-labelledby="tg-headline"
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-12 py-24 md:py-36 lg:py-[clamp(6rem,12vw,11rem)]">

        {/* Section header — asymmetric: label left, headline pushed right */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_3fr] lg:gap-20 lg:items-start">

          <Reveal>
            <div className="flex flex-col gap-6 lg:pt-2">
              <SectionLabel>{trustGating.label}</SectionLabel>
            </div>
          </Reveal>

          <div className="flex flex-col gap-8">
            <Reveal delay={0.08}>
              <h2
                id="tg-headline"
                className="font-display text-[clamp(2rem,4.5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.015em] text-text max-w-[32ch]"
              >
                {trustGating.headlinePre}{" "}
                <AccentWord>{trustGating.headlineAccent}</AccentWord>
                {trustGating.headlinePost && (
                  <>{" "}{trustGating.headlinePost}</>
                )}
              </h2>
            </Reveal>

            <Reveal delay={0.14}>
              <p className="max-w-[58ch] text-[17px] leading-[1.75] text-muted font-sans">
                {trustGating.thesis}
              </p>
            </Reveal>
          </div>
        </div>

        {/* Asymmetric two-state comparison — editorial, not 50/50 */}
        <Reveal delay={0.2}>
          <div className="mt-20 md:mt-28">

            {/* Point line — full width, hairline above */}
            <div className="w-full h-px border-t border-line mb-12" aria-hidden />
            <p className="font-sans text-[13px] uppercase tracking-[0.12em] text-muted mb-16">
              {trustGating.pointLine}
            </p>

            {/* Two-state layout: 3:5 asymmetric — refused left (narrow), paid right (dominant) */}
            <div className="grid grid-cols-1 gap-0 lg:grid-cols-[2fr_3fr]">

              {/* ── Scenario A: REFUSED ──────────────────────────────── */}
              <Reveal delay={0.26}>
                <div className="flex flex-col gap-8 py-10 pr-0 lg:pr-16 border-b border-line lg:border-b-0 lg:border-r lg:border-line">

                  {/* Status label — typographic, not a colored box */}
                  <div className="flex flex-col gap-3">
                    <span
                      className="font-mono text-[10px] tracking-[0.12em] uppercase text-muted"
                      aria-label="Scenario A"
                    >
                      {trustGating.scenarioA.tag}
                    </span>
                    <div
                      aria-hidden
                      className="h-px w-12"
                      style={{ background: "var(--accent-red)", opacity: 0.7 }}
                    />
                    <p className="font-display text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.01em] text-text">
                      {trustGating.scenarioA.status}{" "}
                      <AccentWord>{trustGating.scenarioA.statusAccent}</AccentWord>
                    </p>
                  </div>

                  {/* Config detail */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-xs text-muted tracking-wide">minScore</span>
                      <span className="font-mono text-[1.125rem] font-semibold text-text tabular-nums">
                        {trustGating.scenarioA.minScore}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-xs text-muted tracking-wide">agentScore</span>
                      <span className="font-mono text-[1.125rem] font-semibold text-text tabular-nums">
                        {trustGating.scenarioA.agentScore}
                      </span>
                    </div>
                  </div>

                  {/* Error detail — typographic only, no filled box */}
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-[10px] tracking-[0.10em] text-muted uppercase">
                      Error
                    </span>
                    <p className="font-mono text-[13px] text-text/70">
                      {trustGating.scenarioA.error}
                    </p>
                    <p className="font-sans text-[14px] leading-[1.65] text-muted mt-1">
                      {trustGating.scenarioA.note}
                    </p>
                  </div>
                </div>
              </Reveal>

              {/* ── Scenario B: PAID ─────────────────────────────────── */}
              <Reveal delay={0.34}>
                <div className="flex flex-col gap-8 py-10 pl-0 lg:pl-16">

                  {/* Status label */}
                  <div className="flex flex-col gap-3">
                    <span
                      className="font-mono text-[10px] tracking-[0.12em] uppercase text-muted"
                      aria-label="Scenario B"
                    >
                      {trustGating.scenarioB.tag}
                    </span>
                    <div
                      aria-hidden
                      className="h-px w-12 bg-line"
                    />
                    <p className="font-display text-[clamp(1.75rem,3vw,2.5rem)] font-semibold leading-[1.1] tracking-[-0.01em] text-text">
                      {trustGating.scenarioB.status}
                    </p>
                  </div>

                  {/* Config detail */}
                  <div className="flex flex-col gap-4">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-xs text-muted tracking-wide">minScore</span>
                      <span className="font-mono text-[1.125rem] font-semibold text-text tabular-nums">
                        {trustGating.scenarioB.minScore}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-xs text-muted tracking-wide">agentScore</span>
                      <span className="font-mono text-[1.125rem] font-semibold text-text tabular-nums">
                        {trustGating.scenarioB.agentScore}
                      </span>
                    </div>
                  </div>

                  {/* Result detail */}
                  <div className="flex flex-col gap-2">
                    <span className="font-mono text-[10px] tracking-[0.10em] text-muted uppercase">
                      Result
                    </span>
                    <p className="font-mono text-[13px] text-text/70">
                      {trustGating.scenarioB.result}
                    </p>
                    <p className="font-sans text-[14px] leading-[1.65] text-muted mt-1">
                      {trustGating.scenarioB.note}
                    </p>
                  </div>

                  {/* Code snippet showing the API */}
                  <div className="mt-2 border-t border-line pt-6">
                    <span className="font-mono text-[10px] tracking-[0.10em] text-muted uppercase block mb-4">
                      SDK
                    </span>
                    <pre
                      className="font-mono text-[12px] leading-[1.8] text-text/80 bg-surface px-5 py-4 border border-line overflow-x-auto"
                      aria-label="SDK usage example"
                    >
                      <code>{trustGating.codeExample}</code>
                    </pre>
                  </div>
                </div>
              </Reveal>

            </div>

            {/* Closing hairline */}
            <div className="w-full h-px border-t border-line mt-0 lg:mt-0" aria-hidden />
          </div>
        </Reveal>

      </div>
    </section>
  );
}
