"use client";

import { loadSnapshot } from "@/lib/data/snapshot";
import { useLiveAgents, mergeLiveAgents } from "@/lib/data/useLiveAgents";
import { LiveEnvelopeCard } from "@/components/sections/LiveEnvelopeCard";
import { Reveal } from "@/components/motion/Reveal";
import { hero } from "@/lib/content";

export function Hero() {
  const snapshot = mergeLiveAgents(loadSnapshot(), useLiveAgents());
  // Prefer a real unproven agent for the refusal demo; fall back to the last id.
  const unproven =
    snapshot.agents.find((a) => a.scoreBps === 0) ?? snapshot.agents[snapshot.agents.length - 1];
  const proven = [...snapshot.agents].sort((a, b) => b.scoreBps - a.scoreBps)[0];

  return (
    <section id="hero" className="relative w-full px-6 md:px-10 pt-10 pb-20 md:pt-16 md:pb-28">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        {/* Left — the claim */}
        <div className="flex flex-col gap-7">
          <Reveal mode="mount">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-[#8E8E93]">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-red" />
              {hero.badge}
            </span>
          </Reveal>

          <Reveal mode="mount" delay={0.06}>
            <h1 className="font-sans text-[clamp(2.6rem,6vw,4.6rem)] font-black leading-[0.98] tracking-[-0.03em] text-white">
              Your AI agent can spend your money.
              <br />
              You decide <span className="text-accent-red">how much</span>, and who&apos;s worth
              paying.
            </h1>
          </Reveal>

          <Reveal mode="mount" delay={0.12}>
            <p className="max-w-[54ch] font-sans text-lg leading-relaxed text-[#8E8E93]">
              {hero.subhead}
            </p>
          </Reveal>

          <Reveal mode="mount" delay={0.18}>
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/app"
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 font-sans text-sm font-semibold text-black transition-all duration-300 hover:bg-accent-red hover:text-white"
              >
                Try the demo account →
              </a>
              <a
                href="/docs"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-7 py-3 font-sans text-sm text-white transition-all duration-300 hover:border-white/40 hover:bg-white/5"
              >
                How it works
              </a>
            </div>
          </Reveal>

          {/* What the demo account has actually done — plain counts, no units
              nobody outside this repo would recognise. */}
          <Reveal mode="mount" delay={0.24}>
            <dl className="flex flex-wrap gap-x-10 gap-y-3 border-t border-white/10 pt-6">
              {[
                { k: "Vendors", v: snapshot.agents.length },
                { k: "Jobs paid", v: snapshot.settlements.length },
                { k: "Best track record", v: `${proven?.jobsCompleted ?? 0} jobs` },
              ].map((s) => (
                <div key={s.k} className="flex flex-col gap-0.5">
                  <dt className="font-sans text-xs text-[#8E8E93]">{s.k}</dt>
                  <dd className="font-sans text-xl font-bold tabular-nums text-white">{s.v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>

        {/* Right — the proof, live */}
        <Reveal mode="mount" delay={0.1}>
          <LiveEnvelopeCard unprovenAgentId={unproven?.agentId ?? 7} />
        </Reveal>
      </div>
    </section>
  );
}
