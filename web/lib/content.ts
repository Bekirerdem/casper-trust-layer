/** Single source of truth for all landing-page copy. */

export const developer = {
  label: "For developers",

  headlinePre: "One call.",
  headlineAccent: "Verified",
  headlinePost: "trust.",

  body: "The casper-trust SDK reads on-chain reputation and enforces trust gates in a single async call. No API keys, no off-chain oracle — just a direct read from Casper's public testnet. Prefer MCP? casper-trust-mcp gives Claude and Cursor the same reads as native tools.",

  installCode: "npm install casper-trust",

  usageCode: `import { createTrustClient, getReputation, pay } from "casper-trust";

const trust = createTrustClient(); // wallet-free reads

// Read an agent's on-chain reputation
const { scoreBps } = await getReputation(trust, agentId);

// Trust-gated x402 payment — refused before any gas is spent
await pay({ ...trust, signer }, {
  url: providerEndpoint,
  providerAgentId: agentId,
  minScore: 100n,
});`,

  npmLink: "https://www.npmjs.com/package/casper-trust",
  githubLink: "https://github.com/Bekirerdem/casper-trust-layer",
} as const;

export const finalCta = {
  headlineLine1: "Trust earned on-chain.",
  headlineLine2Pre: "Not",
  headlineLine2Accent: "claimed",
  headlineLine2Post: ".",

  body: "casper-trust is open source and live on Casper testnet. Read the code, verify the settlements, and integrate in minutes.",

  /** Two doors — one per persona. */
  doors: [
    {
      audience: "Operate agents",
      title: "Open the Trust Console",
      body: "Hire an agent, register your own, watch a score move on-chain.",
      href: "/app",
      external: false,
      primary: true,
    },
    {
      audience: "Build on it",
      title: "Gate your endpoint with the SDK",
      body: "One call reads trust, one option gates the x402 payment.",
      href: "https://www.npmjs.com/package/casper-trust",
      external: true,
      primary: false,
    },
  ],

  tertiaryLink: {
    label: "Read the source on GitHub ↗",
    href: "https://github.com/Bekirerdem/casper-trust-layer",
  },
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
      href: "https://github.com/Bekirerdem/casper-trust-layer",
      external: true,
    },
    {
      label: "X / building in public",
      href: "https://x.com/l3ekirerdem",
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

  version: "casper-trust v0.1.2 · casper-test · 2026",
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

  codeExample: `await pay(client, {
  url: endpoint,
  providerAgentId: 0,
  minScore: 100n,  // ← the only variable
});
// score 100 → 402 handshake settles on-chain
// score  99 → TrustGateError, zero gas spent`,
} as const;

export const liveConsole = {
  label: "05 / TRY IT LIVE",

  headlinePre: "Run the gate",
  headlineAccent: "yourself.",
  headlinePost: "",

  thesis:
    "Pick a real on-chain agent, set the trust bar, and watch the gate decide. These are live reputation scores earned from settled escrow jobs on casper-test — read straight from contract storage, no wallet required. Want to move a score yourself? Open the Console, connect Casper Wallet, and hire an agent.",
} as const;

export const liveProof = {
  label: "Proof",

  headlinePre: "Verifiable on-chain.",
  headlineAccent: "Not",
  headlinePost: "a claim.",

  /** Counts come from the live snapshot so the copy never goes stale. */
  footerNote: (settlements: number, agents: number) =>
    `${settlements} real settlements across ${agents} agents. Each escrow written to Casper testnet. Click any row to verify independently — the tx is public, permanent, and requires no trust in us.`,
} as const;

export const problem = {
  label: "02 / THE GAP",

  /** Large Zodiak statement — split for AccentWord. */
  headlinePre: "Reputation today is",
  headlineAccent: "self-reported.",
  headlinePost: "That is not proof.",

  /** Supporting paragraph — the reader's operational pain, not protocol language. */
  body: "Your agent is about to pay a counterparty it has never met. Its track record? Whatever it wrote in its own bio. Agents coordinate, delegate, and transact around the clock — but there is no shared record of who delivered and who defaulted, so every job starts from zero. Without on-chain settlement as the source of truth, trust is theatre.",
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

  /** One-sentence sub-heading — the owner's position, not the protocol's. */
  subhead:
    "Fund a treasury, hand an AI agent the keys to spend it, and let the contract hold the limits: how much per task, how much per day, and who has earned the right to be paid. One call stops everything.",

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
  label: "Built on Casper",
} as const;
