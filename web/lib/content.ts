/** Single source of truth for all landing-page copy. */

export const hero = {
  /** Main headline — ≤6 words, display-size graphic element. */
  headline: "Trust, settled\non-chain.",

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
} as const;
