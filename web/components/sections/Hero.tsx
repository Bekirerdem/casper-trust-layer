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
              Your agent has your money.
              <br />
              The <span className="text-accent-red">contract</span> has your rules.
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
                className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3 font-mono text-xs font-semibold uppercase tracking-widest text-black transition-all duration-300 hover:bg-accent-red hover:text-white"
              >
                Open the console →
              </a>
              <a
                href="/docs"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-7 py-3 font-mono text-xs uppercase tracking-widest text-white transition-all duration-300 hover:border-white/40 hover:bg-white/5"
              >
                Read the docs
              </a>
            </div>
          </Reveal>

          {/* Live network facts — small, factual, no decoration */}
          <Reveal mode="mount" delay={0.24}>
            <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t border-white/10 pt-6 font-mono">
              {[
                { k: "Agents bonded", v: snapshot.agents.length },
                { k: "Settlements", v: snapshot.settlements.length },
                { k: "Top earned score", v: `${proven?.scoreBps ?? 0} bps` },
              ].map((s) => (
                <div key={s.k} className="flex flex-col gap-1">
                  <dt className="text-[9px] uppercase tracking-widest text-[#8E8E93]">{s.k}</dt>
                  <dd className="text-lg font-bold tabular-nums text-white">{s.v}</dd>
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
