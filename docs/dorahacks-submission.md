# DoraHacks BUIDL — submission copy (paste-ready)

> Casper Agentic Buildathon 2026 · **FINAL ROUND** · deadline **26 July 2026 23:59 UTC**
> BUIDL: dorahacks.io/buidl/46686 — editable until judging.
> Jury criteria: technical execution, innovation, agentic AI use, real-world applicability, UX & design, working contracts, long-term launch plans, ecosystem impact.

---

## Name
Casper Trust Layer

## Short description *(the blurb under the title — replace the old one)*
Your AI agent has your money. This is the layer that decides how much it may spend, and who is allowed to receive it. Every customer opens their own on-chain vault with their own rules — and a payee only clears the gate if their track record was earned by settled payments, never claimed.

## One-liner / Vision  *(≤256 chars)*
Owners hand AI agents a budget. The protocol enforces two things at once: the owner's spending limit, and the counterparty's track record — earned only when real escrowed payments settle. No LLM jury, no validator set, no trusted verifier.

## Logo
`web/public/logo.png` (pulse-signal mark) — or a screenshot of the OG card `web/public/og.png`.

## Description (markdown — paste into the long field)

> **⏱ Judges — verify everything yourself in 10 minutes:**
> **[JUDGES.md](https://github.com/Bekirerdem/casper-trust-layer/blob/main/JUDGES.md)**
> The first three checks need **no wallet, no key and no install** — wallet-free reads are this project's own primitive. Start with one command:
> `curl https://casper-trust-layer.vercel.app/api/trust/0`

**The problem, from the side that actually loses money.** Everyone is building agents that can pay. Almost nobody is building for the person whose money it is. The moment you delegate spend to an agent, you own two risks at once: *how much* it can spend, and *who it pays*. Wallets and session keys answer the first. Nothing answers the second — a blockchain proves *that* an agent submitted data, not *whether it delivered*. ERC-8004 stores reputation as subjective client feedback: trivially Sybil- and wash-gameable. So an agent stays inside its budget and still sends every cent to a counterparty that has never delivered anything to anyone.

**What we built.** An owner opens a vault, funds it, and writes the rules: how much per job, how much per day, and how much track record a payee must have. Their agent spends from it. On every payment the contract enforces both halves — the owner's ceiling **and** the payee's earned history — and refuses on-chain when either fails. Nobody decides the score: reputation is a **projection of settled escrow jobs**. It moves only when a real CEP-18 payment settles between two bonded agents *and the paying client calls `approve`*, permanently locking a 2% protocol fee. Faking reputation costs capital, not a prompt.

| | Typical agent-trust design | **Casper Trust Layer** |
|---|---|---|
| Who sets the score | Self-reports, an LLM judge, or a validator set | A settled payment — nobody |
| Cost to fake it | Zero, or the cost of running a model | Locked protocol fee + bond at risk |
| Failure mode | Whoever controls the judge mints trust for free | Bounded: per-edge caps + trust conservation |
| Acting on trust | Read-only registry | The contract refuses the payment before a cent moves |
| Who it is built for | The agent | **The owner whose money it is** |

The one-line positioning against the funded incumbent: **Kite bounds what your agent can spend. We prove who deserves it.**

**Six contracts, live on `casper-test`:**
- **AgentVaults** — multi-tenant: one contract, **a vault per customer**. Owner · agent · per-job ceiling · per-day ceiling · required track record · balance · freeze switch. Ownership is checked on every state-changing call, so nobody can read or move anyone else's money. (A factory-per-user is the EVM pattern; on Casper that bills every signup for a deployment, so tenancy lives inside one contract instead.)
- **IdentityRegistry** — ERC-8004 agent identity + CSPR bond + slash
- **Escrow** — A2A job state machine (fund → deliver → settle), 2% protocol fee permanently locked
- **ReputationEngine** — objective, sybil-resistant score: `Δ = isqrt(value) × counterparty-weight × repeat-dampening`, bounded by per-edge cap + trust conservation (red-teamed with 12 adversarial checks)
- **AgentTreasury (v2)** — the single-tenant envelope that came first, plus an owner-only **`pause()`** that halts every outflow without moving a token
- **Cep18 (AGT)** demo token

**62 tests**, written against what a customer actually worries about — the sharpest being `a_stranger_cannot_touch_your_vault`: an outsider can neither freeze, withdraw, re-rule nor spend from yours.

**Plus:**
- **`casper-trust` npm SDK** — wallet-free reads (`checkTrust`, `getReputation`) + `pay({ minScore })` trust-gated x402 in one call: `npm install casper-trust`
- **`casper-trust-mcp`** — the same reads as MCP tools, so Claude or Cursor can ask *"should I pay this agent?"* against live chain state
- **The dashboard** (`/app`) — connect a wallet and it looks for **your** vault. If you don't have one, you open it: you write the limits, **you sign**. The server never signs on your behalf. Wallet-free visitors still read the whole registry and every agent's track record without connecting anything.

**Live proof — a real 8-agent network, not a single loop:**
- Agent #0 has earned **508 bps over 7 settled jobs from 4 distinct clients**, bonded with 10 CSPR — readable live and wallet-free at `/api/agents/0/passport`
- **14 on-chain settlements** across 8 bonded agents, each independently verifiable on cspr.live
- Agent #7 sits at 0 bps: it was registered from a wallet we do not control, and the escrow refused our attempt to deliver work on its behalf (`NotProvider`) — the protocol defending itself, captured on-chain

**A vault, exercised end to end on testnet — same payment, only the rule changes:**

| What it proves | Transaction |
|---|---|
| Owner opens a vault with their own rules | [`51a90b14…`](https://testnet.cspr.live/transaction/51a90b147d93769a66c33ef833919d8f09a93c8d2d891e41e4fad843f6f27e1a) |
| Funds it | [`c13ef2d0…`](https://testnet.cspr.live/transaction/c13ef2d02e8d3ee55a368922943ac254ab87a86906cc913349461b908d7d82f3) |
| Pays a vendor **with** a track record — settles | [`3aed451f…`](https://testnet.cspr.live/transaction/3aed451f55cb30b36ccd20cd80d8c9e696a1dd1dd79df23954698fdc58bed102) |
| Same payment to a vendor **without** one — refused on-chain (`PayeeNotAllowed`) | [`5f3e803c…`](https://testnet.cspr.live/transaction/5f3e803c74668482c961ab0c029c4d3043610a3d712a6ee420f1bdc5543df34f) |
| Owner freezes the vault | [`d8c30a07…`](https://testnet.cspr.live/transaction/d8c30a07ba1a39ada3f3453b4054a5af0d24e2e2c2411006a750c4446ce62ec5) |
| The **previously accepted** payment now reverts (`Frozen`) | [`c63383cc…`](https://testnet.cspr.live/transaction/c63383cc8246ca04e28be24b583331512f9f149346c434213d90f2a41cfdfc2f) |
| Owner releases it again | [`893cd1f2…`](https://testnet.cspr.live/transaction/893cd1f21934e55c54d3d90d190669ceaa23bed8185781cf404dc6a64afb0831) |

The single-tenant treasury carries the same story with `pause()`: settle → pause → the **identical** payment reverts → unpause → it settles again ([`d9e87d8a…`](https://testnet.cspr.live/transaction/d9e87d8a0bfb1dc4d5580b8e40917bfce82d2c95790531e38fe56afaad2003c7) → [`c96cf67d…`](https://testnet.cspr.live/transaction/c96cf67dabaeb2eb3462278fc2ccc60cd6a14aa604be0dc2775bccf108ffdff8) → [`93bfa521…`](https://testnet.cspr.live/transaction/93bfa52145a64e865aee7d8856b95448e8d406a408ef01428928cbc46e36df7a) → [`e03063e3…`](https://testnet.cspr.live/transaction/e03063e3c7c74efc75ce5ac9a9bf4ed6fa42986183573d6214429d5159d39319)). Delegating spend to an agent is reversible in one owner-only call, and no funds move to prove it.

**Why this belongs on Casper.** The Casper Manifest names smart accounts with scoped spending as a 2026 priority, and Casper's CTO has put it plainly: payment rails *"shouldn't require humans while staying bound to spending limits set by owners on smart accounts."* That is this product's definition — and it does not exist on Casper yet. What the Manifest and the AI Toolkit do **not** cover anywhere is the other half: agent identity, earned reputation, counterparty risk. We built into that gap deliberately, and left it consumable: reads are wallet-free and the SDK is published, so the rest of this cohort can use the primitive instead of rebuilding it. A guard wallet can refuse to sign below a threshold. A multi-hop payment cascade can require a `minScore` at every hop. A marketplace can rank by earned track record instead of self-reported stars — one npm install and one function call away, today.

**Honest status.** Everything above runs on `casper-test`. The mainnet path has three named blockers, in order: agent-side key-management hardening, a stable settlement token so reputation weight isn't coupled to price volatility, and the v2 contract hardening documented in our threat model (§7). We would rather state that plainly than claim production readiness we haven't earned.

## Links
- **⏱ Judge verification path:** https://github.com/Bekirerdem/casper-trust-layer/blob/main/JUDGES.md
- **Live demo:** https://casper-trust-layer.vercel.app  (Dashboard: https://casper-trust-layer.vercel.app/app)
- **Docs:** https://casper-trust-layer.vercel.app/docs
- **npm:** https://www.npmjs.com/package/casper-trust
- **GitHub:** https://github.com/Bekirerdem/casper-trust-layer
- **On-chain addresses + tx proofs:** https://github.com/Bekirerdem/casper-trust-layer/blob/main/DEPLOYMENT.md
- **Reputation formula + threat model:** https://github.com/Bekirerdem/casper-trust-layer/blob/main/docs/reputation-formula.md
- **Demo video:** https://youtu.be/JiDR6VGyZz4

## Casper Testnet Contract Address(es)
```
AgentVaults:      contract-package-674cc233514a5e478f84ea37d657cc6b58d41984b788778d6ca554e6615d6914
IdentityRegistry: contract-package-3a51cc5f4c524f806b3b8899039030bbad141005f81ab99895615d8f050c7adc
ReputationEngine: contract-package-d73fb11144c07ec05071cf986ad65b407f2da91bd871b0c10f67a974832ee7eb
Escrow:           contract-package-fe6b0ddb307549cc9101659abcfaf114e37a8d99461c0632cbce582ebdc4902c
AgentTreasury v2: contract-package-95a5cde87caeeee469f6708b4cdbb8ee6b74bf9a50bab429287cc1400ef32f1a
Cep18 (AGT demo token): contract-package-f962076e6c2ba423aaade9f75935ff37ef4aa4cde6077bac9a259af141c3d5c6

Deployed from account 02035b3ea46df7a08c778d0ebfbe21f7ab2442030d038a7a55cd3058a452ba40f0c7
Install + wiring transactions: https://github.com/Bekirerdem/casper-trust-layer/blob/main/DEPLOYMENT.md
```

## Track
Casper Innovation Track

## Technology Stack Used *(checkboxes)*
Odra Framework · CSPR.cloud · JavaScript/TypeScript SDK · x402 Facilitator · Casper MCP Server

*(free-text field, if present):* Rust, Odra 2.8, Casper 2.0 (Condor), ERC-8004, x402, CEP-18, TypeScript, casper-js-sdk, Next.js, MCP

## Progress / status
Live on Casper testnet — six contracts deployed, wired and independently verifiable. Working product, not a prototype demo.

## Team
Solo — Bekir (Ebubekir Erdem). Contracts + SDK + frontend end-to-end.
