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
  headlineLine1: "Let it spend.",
  headlineLine2Pre: "Keep the",
  headlineLine2Accent: "keys",
  headlineLine2Post: ".",

  body: "Open the demo account and try to break its rules — send too much, pay a vendor with no history, or freeze it mid-payment. Nothing is simulated; every attempt leaves a receipt.",

  /** Two doors — one per persona. */
  doors: [
    {
      audience: "See it work",
      title: "Open the demo account",
      body: "Set a limit, try to overspend, watch the payment get refused.",
      href: "/app",
      external: false,
      primary: true,
    },
    {
      audience: "Put it in your product",
      title: "Add it with one call",
      body: "Check a vendor before you pay, in a single line of code.",
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
    "Spending limits your AI agent cannot argue with. Every payment, and every refusal, leaves a receipt.",

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
    "A vendor's history is what it was paid for, not what it says about itself.",

  version: "casper-trust v0.1.2 · casper-test · 2026",
} as const;

export const liveProof = {
  label: "Receipts",

  headlinePre: "Every payment leaves",
  headlineAccent: "a receipt",
  headlinePost: "you can open.",

  /** Counts come from the live snapshot so the copy never goes stale. */
  footerNote: (settlements: number, agents: number) =>
    `${settlements} paid jobs across ${agents} vendors. Every one of them has a receipt anyone can open — including the payments that were refused. You do not have to take our word for any number on this page.`,
} as const;

export const hero = {
  /**
   * Main headline — split into segments so AccentWord can wrap one word.
   * Rendered as: "Agent <AccentWord>Trust</AccentWord> Layer"
   */
  headlinePre: "Agent",
  headlineAccent: "Trust",
  headlinePost: "Layer",

  /** Written for the person whose money it is — no protocol vocabulary. */
  subhead:
    "Give it a budget instead of your wallet. Set what it can spend per job and per day, let it pay only vendors that have finished paid work before, and freeze everything the moment you want to.",

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
