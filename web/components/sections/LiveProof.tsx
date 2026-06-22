import { loadSnapshot } from "@/lib/data/snapshot";
import { liveProof } from "@/lib/content";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AccentWord } from "@/components/ui/AccentWord";
import { Reveal } from "@/components/motion/Reveal";

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

function formatScoreDelta(before: number, after: number): string {
  const delta = after - before;
  return delta > 0 ? `+${delta} bps` : `${delta} bps`;
}

export function LiveProof() {
  const snapshot = loadSnapshot();

  return (
    <section
      id="live-proof"
      className="w-full bg-bg"
      aria-labelledby="lp-headline"
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-12 py-24 md:py-36 lg:py-[clamp(6rem,12vw,11rem)]">

        {/* Header — tight editorial, left-anchored */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_3fr] lg:gap-20 lg:items-end mb-20 md:mb-28">

          <Reveal>
            <div className="flex flex-col gap-6">
              <SectionLabel>{liveProof.label}</SectionLabel>
              <div
                aria-hidden
                className="h-[1px] w-8"
                style={{ background: "var(--accent-gold)" }}
              />
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <h2
              id="lp-headline"
              className="font-display text-[clamp(2rem,4.5vw,4rem)] font-semibold leading-[1.05] tracking-[-0.015em] text-text max-w-[30ch]"
            >
              {liveProof.headlinePre}{" "}
              <AccentWord>{liveProof.headlineAccent}</AccentWord>
              {liveProof.headlinePost && (
                <>{" "}{liveProof.headlinePost}</>
              )}
            </h2>
          </Reveal>
        </div>

        {/* Settlement list — editorial, factual */}
        <Reveal delay={0.14}>
          <div className="flex flex-col">

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 sm:gap-8 pb-4 border-b border-line">
              <span className="font-sans text-[10px] uppercase tracking-[0.12em] text-muted">Tx Hash</span>
              <span className="font-sans text-[10px] uppercase tracking-[0.12em] text-muted text-right hidden sm:block">Score</span>
              <span className="font-sans text-[10px] uppercase tracking-[0.12em] text-muted text-right">Proof</span>
            </div>

            {/* Settlement rows */}
            {snapshot.settlements.map((s, i) => (
              <Reveal key={s.txHash} delay={0.2 + i * 0.06}>
                <div>
                  <div className="grid grid-cols-[1fr_auto_auto] gap-4 sm:gap-8 py-5 border-b border-line items-center">

                    {/* Hash + score delta (mobile: stacked) */}
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="font-mono text-[13px] sm:text-[14px] text-text tabular-nums truncate">
                        {shortHash(s.txHash)}
                      </span>
                      <span className="font-mono text-[11px] text-muted sm:hidden">
                        {formatScoreDelta(s.scoreBefore, s.scoreAfter)}
                      </span>
                    </div>

                    {/* Score delta — desktop only */}
                    <span className="font-mono text-[13px] text-muted text-right hidden sm:block tabular-nums whitespace-nowrap">
                      {formatScoreDelta(s.scoreBefore, s.scoreAfter)}
                    </span>

                    {/* cspr.live link */}
                    <a
                      href={`https://testnet.cspr.live/deploy/${s.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-sans text-[11px] uppercase tracking-[0.10em] text-muted hover:text-text transition-colors whitespace-nowrap underline underline-offset-4 decoration-line hover:decoration-text text-right"
                      aria-label={`View transaction ${s.txHash} on cspr.live`}
                    >
                      cspr.live ↗
                    </a>
                  </div>
                </div>
              </Reveal>
            ))}

          </div>
        </Reveal>

        {/* Footer note */}
        <Reveal delay={0.5}>
          <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-sans text-[14px] leading-[1.7] text-muted max-w-[52ch]">
              {liveProof.footerNote}
            </p>
            <p className="font-mono text-[10px] text-muted/50 tabular-nums whitespace-nowrap">
              network: {snapshot.network} · {new Date(snapshot.capturedAt).toISOString().slice(0, 10)}
            </p>
          </div>
        </Reveal>

      </div>
    </section>
  );
}
