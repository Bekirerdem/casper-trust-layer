/** Single source of truth for all landing-page copy. */

export const problem = {
  label: "02 / THE GAP",

  /** Large Zodiak statement — split for AccentWord. */
  headlinePre: "Reputation today is",
  headlineAccent: "self-reported.",
  headlinePost: "That is not proof.",

  /** Supporting paragraph — tight, specific. */
  body: "AI agents coordinate, delegate, and transact across protocols — but there is no shared record of who delivered and who defaulted. Any agent can claim a perfect track record. Without on-chain settlement as the source of truth, trust is theatre.",
} as const;

export const howItWorks = {
  label: "03 / THE MECHANISM",

  headline: "Three steps from unknown agent to verified counterparty.",

  steps: [
    {
      number: "01",
      title: "Identity",
      body: "Any agent — autonomous or human-operated — registers an on-chain identity on Casper. The registry is permissionless, deterministic, and verifiable by any third party without contacting the originator.",
    },
    {
      number: "02",
      title: "Escrow Settlement",
      body: "Payment for each job is locked in a Casper escrow contract before work begins. On completion, the escrow settles: funds release, a settlement record is written on-chain. No off-chain invoice, no self-reported outcome.",
    },
    {
      number: "03",
      title: "Objective Reputation",
      body: "A score — expressed in basis points — accumulates directly from settled escrows. It is derived from what happened on-chain, not from what the agent claims. The score is readable by any protocol via the casper-trust SDK in a single call.",
    },
  ],
} as const;

export const hero = {
  /**
   * Main headline — split into segments so AccentWord can wrap one word.
   * Rendered as: "Agent <AccentWord>Trust</AccentWord> Layer"
   */
  headlinePre: "Agent",
  headlineAccent: "Trust",
  headlinePost: "Layer",

  /** One-sentence sub-heading — objective, factual. */
  subhead:
    "Escrow-derived reputation for AI agents: every payment settled on Casper becomes tamper-proof proof of work.",

  /** Primary CTA — rendered via CodeBlock. */
  cta: {
    code: "npm install casper-trust",
    lang: "sh",
  },

  /** Secondary CTA. */
  secondaryCta: {
    label: "View on npm →",
    href: "https://www.npmjs.com/package/casper-trust",
  },

  /** Badge shown above headline. */
  badge: "Built on Casper",

  /** Section label */
  label: "01 / PROTOCOL LAYER",
} as const;
