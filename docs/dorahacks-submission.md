# DoraHacks BUIDL — submission copy (paste-ready)

> Casper Agentic Buildathon 2026 · deadline **7 Temmuz 2026 23:59 UTC**
> Submit: dorahacks.io/hackathon/2202/buidl · Bekir hesabı

---

## Name
Casper Trust Layer

## One-liner / Vision
On-chain trust infrastructure for AI agents on Casper — reputation **earned from settled, paid work** (not self-reported), with **x402 payments gated on it**. The missing trust-and-accountability layer that lets agent-to-agent payments scale safely.

## Logo
`web/public/logo.png` (pulse-signal mark) — or screenshot of the OG card `web/public/og.png`.

## Description (markdown — paste into the long field)

**The gap.** The agent economy is coming, but there's a hole at its center: why would you trust — or pay — an AI agent you've never met? A blockchain proves *that* an agent submitted data, not *whether it delivered*. ERC-8004 stores reputation as subjective client feedback — trivially Sybil- and wash-gameable.

**Our wedge.** Reputation is a **projection of settled escrow jobs**. A score only moves when a real CEP-18 payment settles between two bonded agents — so fabricating reputation costs real money and cannot be faked. That score then becomes a **payment gate**: agents pay each other over x402 only when the counterparty's earned trust clears the bar.

**What we built (5 contracts live on casper-test):**
- **IdentityRegistry** — ERC-8004 agent identity + bond + slash
- **Escrow** — A2A job state machine (fund → deliver → settle), 2% burn fee
- **ReputationEngine** — objective, sybil-resistant score: `Δ = isqrt(value) × counterparty-weight × repeat-dampening`, bounded by per-edge cap + trust conservation (red-teamed against bought-edge / wash / Sybil)
- **AgentTreasury** — capped spend envelope (per-task 100 AGT + daily 500 AGT) + **contract-level reputation gate**
- **Cep18 (AGT)** demo token

**Plus:**
- **`casper-trust` npm SDK** — wallet-free reads (`checkTrust`, `getReputation`) + `pay({ minScore })` trust-gated x402 in one call
- **Live x402 handshake** settled on-chain via the hosted CSPR.cloud facilitator
- **Trust Console** (`/app`) — explore the agent registry + scores wallet-free, run the trust gate live, and **register your own agent with Casper Wallet**

**Live proof (casper-test) — a real 4-agent network, not a single loop:**
- Agent #0 earned **408 bps over 6 settled jobs**, reputation flowing from multiple counterparties
- 7 on-chain settlements, each independently verifiable on cspr.live
- Cross-edge examples: 2→0 (`6a7d54e8…`), 3→0 (`9e490f62…`), bootstrap 0→2 (`b5d6c3b9…`)

**Why us vs the field:** objective, payment-backed reputation (not an LLM/jury verdict that can be gamed) + a published SDK any project integrates in one line + a reusable x402 trust-gating primitive.

## Links
- **Live demo:** https://casper-trust-layer.vercel.app  (Console: https://casper-trust-layer.vercel.app/app)
- **npm:** https://www.npmjs.com/package/casper-trust
- **GitHub:** https://github.com/Bekirerdem/casper-trust-layer
- **On-chain proofs / addresses:** DEPLOYMENT.md in the repo
- **Demo video:** << YouTube link — Bekir uploads ~/Desktop/casper-trust-demo.mp4 >>

## Track
Agentic AI + DeFi + RWA (single track)

## Infrastructure / tech tags
Rust · Odra 2.8 · Casper 2.0 · ERC-8004 · x402 · CEP-18 · TypeScript · casper-js-sdk · Next.js

## Team
Solo — Bekir (Ebubekir Erdem). Contracts + SDK + frontend end-to-end.
