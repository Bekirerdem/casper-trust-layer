"use client";

import { Reveal } from "@/components/motion/Reveal";

/**
 * Three ways the account says no, written as the account owner would say them.
 * Each links to the receipt of a payment that was actually refused.
 */
const RULES = [
  {
    rule: "Who gets paid",
    setting: "Vendors with completed jobs",
    story:
      "A vendor nobody has ever paid can't receive your money — no matter how convincing it looks to your agent. A track record here isn't a profile it wrote about itself; it's work someone already paid for.",
    blocked: "Blocked — no track record",
    tx: "19ddb53be543487fe8d6e25eb8278231e59ec90ee0cd00d550294cd77d8c4d13",
  },
  {
    rule: "How much",
    setting: "$100 per job · $500 per day",
    story:
      "Limits are counted per job and per day. If your agent finds a reason to send more than you allowed, the payment doesn't go through — it isn't flagged for review later, it simply never happens.",
    blocked: "Blocked — over the limit",
    tx: "c96cf67dabaeb2eb3462278fc2ccc60cd6a14aa604be0dc2775bccf108ffdff8",
  },
  {
    rule: "Whether at all",
    setting: "Freeze, any time",
    story:
      "One switch stops every payment, instantly. Nothing moves out of the account and nothing has to be undone — whatever your agent was talked into doing, it stops there.",
    blocked: "Blocked — spending frozen",
    tx: "c96cf67dabaeb2eb3462278fc2ccc60cd6a14aa604be0dc2775bccf108ffdff8",
  },
] as const;

export function ThreeRules() {
  return (
    <section id="rules" className="relative w-full px-6 md:px-10 py-24 md:py-28">
      <div className="mx-auto max-w-[1200px]">
        <Reveal>
          <div className="flex max-w-[60ch] flex-col gap-4">
            <h2 className="font-sans text-[clamp(2rem,4.2vw,3.4rem)] font-black leading-[1.05] tracking-[-0.02em] text-ink">
              Three ways your account says no.
            </h2>
            <p className="font-sans text-base leading-relaxed text-muted">
              Not warnings, not alerts after the fact. Each of these already stopped a real payment —
              the receipts are below.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
          {RULES.map((r, i) => (
            <Reveal key={r.rule} delay={0.06 * i}>
              <article className="group flex h-full flex-col gap-4 rounded-2xl border border-line bg-surface p-6 transition-colors duration-500 hover:border-accent-red/30 hover:bg-subtle">
                <div className="flex flex-col gap-1">
                  <h3 className="font-sans text-2xl font-black tracking-tight text-ink">{r.rule}</h3>
                  <p className="font-sans text-sm text-accent-red">{r.setting}</p>
                </div>

                <p className="flex-1 font-sans text-sm leading-relaxed text-muted">{r.story}</p>

                <a
                  href={`https://testnet.cspr.live/transaction/${r.tx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-lg border border-line bg-subtle px-4 py-3 transition-colors hover:border-accent-red/40"
                >
                  <span className="font-sans text-xs font-semibold text-accent-red">{r.blocked}</span>
                  <span className="font-sans text-xs text-muted transition-colors group-hover:text-ink">
                    See receipt ↗
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
