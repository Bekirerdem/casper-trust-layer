/** Single source of truth for all landing-page copy. */

export const developer = {
  label: "06 / BUILD",

  headlinePre: "One call.",
  headlineAccent: "Verified",
  headlinePost: "trust.",

  body: "The casper-trust SDK reads on-chain reputation and enforces trust gates in a single async call. No API keys, no off-chain oracle — just a direct read from Casper's public testnet.",

  installCode: "npm install casper-trust",

  usageCode: `import { createTrustClient } from "casper-trust";

const trust = createTrustClient();

// Read an agent's on-chain reputation
const { scoreBps } = await trust.getReputation(agentId);

// Enforce a trust gate before payment (x402)
await trust.pay({ minScore: 9000 }); // trust-gated x402`,

  npmLink: "https://www.npmjs.com/package/casper-trust",
  githubLink: "https://github.com/bekirerdem/casper-trust",
} as const;

export const finalCta = {
  headlineLine1: "Trust earned on-chain.",
  headlineLine2Pre: "Not",
  headlineLine2Accent: "claimed",
  headlineLine2Post: ".",

  body: "casper-trust is open source and live on Casper testnet. Read the code, verify the settlements, and integrate in minutes.",
} as const;

export const siteFooter = {
  wordmark: "Casper Trust Layer",

  tagline:
    "Escrow-derived reputation for AI agents. Every settlement is permanent, public, and verifiable by any protocol.",

  links: [
    {
      label: "npm package",
      href: "https://www.npmjs.com/package/casper-trust",
      external: true,
    },
    {
      label: "GitHub",
      href: "https://github.com/bekirerdem/casper-trust",
      external: true,
    },
    {
      label: "Casper Network",
      href: "https://casper.network",
      external: true,
    },
    {
      label: "Testnet explorer",
      href: "https://testnet.cspr.live",
      external: true,
    },
  ],

  footerQuote:
    "In a world of self-reported credentials, on-chain settlement is the only proof that does not lie.",

  version: "v0.1.0-testnet · casper-trust · 2026",
} as const;

export const trustGating = {
  label: "04 / TRUST-GATING",

  headlinePre: "Same endpoint.",
  headlineAccent: "Different",
  headlinePost: "outcome.",

  thesis:
    "A provider can set a minimum trust score before accepting a job. Agents below the threshold are refused before payment ever reaches the chain. No penalty, no gas waste — just a gate earned by track record.",

  /** The core point line shown between heading and scenarios. */
  pointLine: "Same endpoint. Same provider. The only variable is earned trust.",

  scenarioA: {
    tag: "Scenario A",
    status: "Payment",
    statusAccent: "refused.",
    minScore: 101,
    agentScore: 100,
    error: "TrustGateError: score below threshold",
    note: "Payment never hits the chain. The escrow transaction is not initiated. Zero gas spent.",
  },

  scenarioB: {
    tag: "Scenario B",
    status: "Payment settles.",
    minScore: 100,
    agentScore: 100,
    result: "escrow settled · on-chain",
    note: "Score meets the threshold exactly. Escrow settles. Reputation increments.",
  },

  codeExample: `const gate = await trust.gate({
  agentId: 0,
  minScore: 100,   // ← the only variable
});
// score 100 → settles
// score  99 → TrustGateError`,
} as const;

export const liveProof = {
  label: "05 / PROOF",

  headlinePre: "Verifiable on-chain.",
  headlineAccent: "Not",
  headlinePost: "a claim.",

  footerNote:
    "Five real settlements. Each escrow written to Casper testnet. Click any row to verify independently — the tx is public, permanent, and requires no trust in us.",
} as const;

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
