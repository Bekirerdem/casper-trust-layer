# DoraHacks BUIDL — submission copy (paste-ready)

> Casper Agentic Buildathon 2026 · **FINAL ROUND** · deadline **26 July 2026 23:59 UTC**
> BUIDL submitted: dorahacks.io/buidl/46686 — editable until judging.
> Jury criteria: technical execution, innovation, agentic AI use, real-world applicability, UX & design, working contracts, long-term launch plans, ecosystem impact.

---

## Name
Casper Trust Layer

## One-liner / Vision  *(≤256 chars)*
No judge decides reputation here — the payment does. On-chain trust for AI agents on Casper: a score moves only when a real escrowed payment settles, and x402 payments are gated on it. No LLM jury, no validator set, no trusted verifier.

## Logo
`web/public/logo.png` (pulse-signal mark) — or a screenshot of the OG card `web/public/og.png`.

## Description (markdown — paste into the long field)

> **⏱ Judges — verify everything yourself in 10 minutes:**
> **[JUDGES.md](https://github.com/Bekirerdem/casper-trust-layer/blob/main/JUDGES.md)**
> The first three checks need **no wallet, no key and no install** — wallet-free reads are this project's own primitive. Start with one command:
> `curl https://casper-trust-layer.vercel.app/api/trust/0`

**The gap.** The agent economy is coming, but there's a hole at its centre: why would you trust — or pay — an AI agent you have never met? A blockchain proves *that* an agent submitted data, not *whether it delivered*. ERC-8004 stores reputation as subjective client feedback — trivially Sybil- and wash-gameable.

**Our wedge — nobody decides the score.** Reputation here is a **projection of settled escrow jobs**. There is no LLM jury, no staked validator committee, no trusted verifier anywhere in the scoring path. A score moves only when a real CEP-18 payment settles between two bonded agents *and the paying client calls `approve`*, permanently locking a 2% protocol fee. Fabricating reputation costs capital rather than costing a prompt. That score then becomes a **payment gate**: agents pay each other over x402 only when the counterparty's earned trust clears the bar.

| | Typical agent-trust design | **Casper Trust Layer** |
|---|---|---|
| Who sets the score | Self-reports, an LLM judge, or a validator set | A settled payment — nobody |
| Cost to fake it | Zero, or the cost of running a model | Locked protocol fee + bond at risk |
| Failure mode | Whoever controls the judge mints trust for free | Bounded: per-edge caps + trust conservation |
| Acting on trust | Read-only registry | `pay({ minScore })` — refuses before a cent moves |

**What we built — 5 contracts live on `casper-test`:**
- **IdentityRegistry** — ERC-8004 agent identity + CSPR bond + slash
- **Escrow** — A2A job state machine (fund → deliver → settle), 2% protocol fee permanently locked
- **ReputationEngine** — objective, sybil-resistant score: `Δ = isqrt(value) × counterparty-weight × repeat-dampening`, bounded by per-edge cap + trust conservation (red-teamed with 12 adversarial checks)
- **AgentTreasury** — capped spend envelope (per-task 100 AGT + daily 500 AGT) + **contract-level reputation gate**
- **Cep18 (AGT)** demo token

**Plus:**
- **`casper-trust` npm SDK** — wallet-free reads (`checkTrust`, `getReputation`) + `pay({ minScore })` trust-gated x402 in one call. Installable and verifiable today: `npm install casper-trust`
- **`casper-trust-mcp`** — the same reads as MCP tools, so Claude or Cursor can ask *"should I pay this agent?"* against live chain state
- **Trust Console** (`/app`) — explore the registry and every agent's track record **without connecting anything**; connect Casper Wallet and it becomes your agent's passport: identity, bond, earned score, clearance, plus a full register → faucet → hire → approve loop that moves a score on-chain from transactions *you* sign

**Live proof (casper-test) — a real multi-agent network, not a single loop:**
- Agent #0 has earned **508 bps over 7 settled jobs from 4 distinct clients**, bonded with 10 CSPR — all readable live, wallet-free, at `/api/agents/0/passport`
- 11+ on-chain settlements, each independently verifiable on cspr.live
- Cross-edge examples: 2→0 (`6a7d54e8…`), 3→0 (`9e490f62…`), bootstrap 0→2 (`b5d6c3b9…`)
- A browser visitor's own wallet-signed hire flow settled `100 → 200` (`04cea776…`)
- Trust-gated x402: the *same* endpoint refused below the bar and settled above it (`b4a4635f…`)

**Why this matters beyond us.** We ship a primitive, not an application — which means the rest of this cohort can consume it. A guard wallet can refuse to sign when a counterparty's score is below a threshold. A multi-hop payment cascade can require a `minScore` at every hop. An agent marketplace can rank by earned track record instead of self-reported stars. That is one npm install and one function call away, today — and it is the reason we kept reads wallet-free and published the SDK rather than hiding the logic behind our own UI.

**Honest status.** Everything above runs on `casper-test`. The mainnet path has three named blockers, in order: agent-side key-management hardening, a stable settlement token so reputation weight isn't coupled to price volatility, and the v2 contract hardening documented in our threat model (§7). We would rather state that plainly than claim production readiness we haven't earned.

## Links
- **⏱ Judge verification path:** https://github.com/Bekirerdem/casper-trust-layer/blob/main/JUDGES.md
- **Live demo:** https://casper-trust-layer.vercel.app  (Console: https://casper-trust-layer.vercel.app/app)
- **npm:** https://www.npmjs.com/package/casper-trust
- **GitHub:** https://github.com/Bekirerdem/casper-trust-layer
- **On-chain addresses + tx proofs:** https://github.com/Bekirerdem/casper-trust-layer/blob/main/DEPLOYMENT.md
- **Reputation formula + threat model:** https://github.com/Bekirerdem/casper-trust-layer/blob/main/docs/reputation-formula.md
- **Demo video:** https://youtu.be/H0BoEYr47q4

## Casper Testnet Contract Address(es)
```
IdentityRegistry: contract-package-3a51cc5f4c524f806b3b8899039030bbad141005f81ab99895615d8f050c7adc
ReputationEngine: contract-package-d73fb11144c07ec05071cf986ad65b407f2da91bd871b0c10f67a974832ee7eb
Escrow: contract-package-fe6b0ddb307549cc9101659abcfaf114e37a8d99461c0632cbce582ebdc4902c
AgentTreasury: contract-package-abbdbdfd40fc241983efda0d42efabdc2b919d6b94fe1e2849e98d6e640e763c
Cep18 (AGT demo token): contract-package-f962076e6c2ba423aaade9f75935ff37ef4aa4cde6077bac9a259af141c3d5c6

Deployed from account 02035b3ea46df7a08c778d0ebfbe21f7ab2442030d038a7a55cd3058a452ba40f0c7
Install + wiring transactions: https://github.com/Bekirerdem/casper-trust-layer/blob/main/DEPLOYMENT.md
```

## Track
Casper Innovation Track

## Technology Stack Used *(checkboxes)*
Odra Framework · CSPR.cloud · JavaScript/TypeScript SDK · x402 Facilitator · Casper MCP Server

## Team
Solo — Bekir (Ebubekir Erdem). Contracts + SDK + frontend end-to-end.
