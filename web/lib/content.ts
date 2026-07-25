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

export const liveProof = {
  label: "Proof",

  headlinePre: "Verifiable on-chain.",
  headlineAccent: "Not",
  headlinePost: "a claim.",

  /** Counts come from the live snapshot so the copy never goes stale. */
  footerNote: (settlements: number, agents: number) =>
    `${settlements} real settlements across ${agents} agents. Each escrow written to Casper testnet. Click any row to verify independently — the tx is public, permanent, and requires no trust in us.`,
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
