"use client";

import { Reveal } from "@/components/motion/Reveal";

/**
 * The three things the contract refuses, each backed by a transaction where it
 * actually refused. Order matters: identity of the payee, size of the payment,
 * then the owner's override — narrowest rule to widest authority.
 */
const RULES = [
  {
    rule: "Who gets paid",
    enforced: "whitelisted, or proven by settled work",
    story:
      "A counterparty with no earned track record is refused before the treasury even checks its balance. Trust here is not a claim — it is the residue of payments that already settled.",
    refusal: "BelowReputationThreshold",
    tx: "19ddb53be543487fe8d6e25eb8278231e59ec90ee0cd00d550294cd77d8c4d13",
  },
  {
    rule: "How much",
    enforced: "per-task and per-day ceilings",
    story:
      "Spend is accounted per task and per UTC day. An agent that finds a reason to send more than the owner allowed does not get a warning; the transaction reverts and the money never moves.",
    refusal: "ExceedsTaskLimit",
    tx: "c96cf67dabaeb2eb3462278fc2ccc60cd6a14aa604be0dc2775bccf108ffdff8",
  },
  {
    rule: "Whether at all",
    enforced: "owner-only brake",
    story:
      "One call halts every payment and reservation without moving a token. Whatever the agent has been talked into doing, the owner ends it — and the funds stay exactly where they are.",
    refusal: "Paused",
    tx: "c96cf67dabaeb2eb3462278fc2ccc60cd6a14aa604be0dc2775bccf108ffdff8",
  },
] as const;

export function ThreeRules() {
  return (
    <section id="rules" className="relative w-full px-6 md:px-10 py-24 md:py-32">
      <div className="mx-auto max-w-[1200px]">
        <Reveal>
          <div className="flex flex-col gap-4 max-w-[62ch]">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-red">
              What the contract refuses
            </span>
            <h2 className="font-sans text-[clamp(2rem,4.2vw,3.4rem)] font-black leading-[1.05] tracking-[-0.02em] text-white">
              Three rules the agent cannot talk its way past.
            </h2>
            <p className="font-sans text-base leading-relaxed text-[#8E8E93]">
              Each one has already refused a real payment on casper-test. The refusal cost gas and
              was written to the chain — open any of them and read it.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-3">
          {RULES.map((r, i) => (
            <Reveal key={r.rule} delay={0.06 * i}>
              <article className="group flex h-full flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-colors duration-500 hover:border-accent-red/30 hover:bg-white/[0.04]">
                <div className="flex flex-col gap-1.5">
                  <h3 className="font-sans text-2xl font-black tracking-tight text-white">{r.rule}</h3>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#8E8E93]">
                    {r.enforced}
                  </p>
                </div>

                <p className="flex-1 font-sans text-sm leading-relaxed text-[#8E8E93]">{r.story}</p>

                <a
                  href={`https://testnet.cspr.live/transaction/${r.tx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-mono text-[10px] transition-colors hover:border-accent-red/40"
                >
                  <span className="font-bold uppercase tracking-widest text-accent-red">
                    ✕ {r.refusal}
                  </span>
                  <span className="text-[#8E8E93] transition-colors group-hover:text-white">
                    verify ↗
                  </span>
                </a>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
