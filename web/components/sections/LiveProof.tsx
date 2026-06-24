import { loadSnapshot } from "@/lib/data/snapshot";
import { liveProof } from "@/lib/content";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AccentWord } from "@/components/ui/AccentWord";
import { BentoGrid, BentoCell } from "@/components/ui/BentoGrid";
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
  const agent0 = snapshot.agents.find((a) => a.agentId === 0);

  return (
    <section id="live-proof" className="w-full bg-bg" aria-labelledby="lp-headline">
      <div className="mx-auto max-w-[1280px] px-6 md:px-12 [padding-block:clamp(6rem,10vw,10rem)]">

        {/* Asymmetric header */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_2fr] lg:items-end mb-14 md:mb-20">
          <Reveal>
            <SectionLabel>{liveProof.label}</SectionLabel>
          </Reveal>
          <Reveal delay={0.08}>
            <h2
              id="lp-headline"
              className="font-display text-[clamp(2rem,4.5vw,4rem)] font-semibold leading-[1.04] tracking-[-0.015em] text-text max-w-[26ch]"
            >
              {liveProof.headlinePre} <AccentWord>{liveProof.headlineAccent}</AccentWord>
              {liveProof.headlinePost && <>{" "}{liveProof.headlinePost}</>}
            </h2>
          </Reveal>
        </div>

        {/* Bento: hero reputation tile + settlement tiles */}
        <BentoGrid>
          <Reveal>
            <BentoCell
              span="md:col-span-1 md:row-span-2"
              className="flex flex-col justify-between min-h-[260px]"
            >
              <span className="font-sans text-[10px] uppercase tracking-[0.12em] text-muted">
                agent #0 · live reputation
              </span>
              <div>
                <div className="font-mono text-[clamp(3rem,6vw,5rem)] leading-none text-text tabular-nums">
                  {agent0?.scoreBps ?? 0}
                </div>
                <div className="mt-2 font-mono text-xs text-muted">
                  bps · {agent0?.jobsCompleted ?? 0} jobs settled on-chain
                </div>
              </div>
            </BentoCell>
          </Reveal>

          {snapshot.settlements.map((s, i) => (
            <Reveal key={s.txHash} delay={0.06 + i * 0.05}>
              <BentoCell className="flex flex-col justify-between min-h-[120px]">
                <span className="font-mono text-[13px] text-text tabular-nums truncate">
                  {shortHash(s.txHash)}
                </span>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-[12px] text-accent-red tabular-nums">
                    {formatScoreDelta(s.scoreBefore, s.scoreAfter)}
                  </span>
                  <a
                    href={`https://testnet.cspr.live/deploy/${s.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-sans text-[10px] uppercase tracking-[0.10em] text-muted hover:text-text transition-colors whitespace-nowrap"
                    aria-label={`View transaction ${s.txHash} on cspr.live`}
                  >
                    cspr.live ↗
                  </a>
                </div>
              </BentoCell>
            </Reveal>
          ))}
        </BentoGrid>

        {/* Footer note */}
        <Reveal delay={0.4}>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
