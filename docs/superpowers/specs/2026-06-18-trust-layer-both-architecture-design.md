# Casper Agent Trust Layer — "Closed Product AND Open Substrate" Design

> Status: **Validated · open questions resolved (fresh-mind review done 2026-06-18)** · Date: 2026-06-18 · Owner: Bekir (solo) · Buildathon deadline: 2026-06-30
>
> This spec captures the architecture decision reached after a 5-agent adversarial validation
> workflow. It is the anchor for the next session's implementation plan. The on-chain contracts
> are already built, tested (31 OdraVM tests), and **live on `casper-test`** (see `DEPLOYMENT.md`);
> this spec covers what we build **on top of and around** them — and, critically, what we deliberately
> do **not** build before the deadline.

---

## 1. Context

The Casper Agentic Buildathon now has ~40 submitted BUIDLs. Our space (agent trust / reputation /
identity) is **no longer empty** — it is contested but shallow:

| Competitor | What it is | How we differ |
|---|---|---|
| **cred402** | Credit scores for agents (live console + API) | AI-computed score; we are the **objective, payment-backed** source it would read |
| **credmesh** | Credit infra for agents (CSPR.fans vote leader) | Built on **Base, not Casper** — weak for jury |
| **Asasanta / Nexus Guardian** | AI/KYC trust scoring + fraud | Subjective/KYC; we are **cryptoeconomic, escrow-derived** |

Two facts shape the plan:
1. **40/40 BUIDLs ship a demo video.** It is mandatory and universal — ours is the highest-priority gap.
2. **No x402 TypeScript client exists for Casper.** Every `x402-casper` / `@x402/casper` npm name 404s;
   Casper shipped only a server-side Facilitator + MCP. The ~9 x402-payment BUIDLs each hand-roll the
   same handshake. This is an open ecosystem gap we can own.

## 2. The decision

**We are both a polished closed product and an open trust substrate — because they are one codebase, two surfaces.**

- **Closed product (the hero demo):** the deployed `escrow → reputation → read` loop. A client agent
  hires a provider, escrow locks CEP-18, work is approved, funds settle (2% burn), and reputation
  accrues to the provider's *identity*. Demoable end-to-end, on live testnet.
- **Open substrate (the ecosystem play):** every reputation **read** is already a public, free,
  zero-auth on-chain view. cred402, the x402 cluster, any agent — all can read "is agent X trustworthy"
  in one line, at $0 integration cost, with no new on-chain code.

> **Openness comes from the READ path, not the WRITE path.** This is the load-bearing insight.

## 3. Why open-write is deferred (the critical security finding)

The validation **refuted** an earlier proposal to open the write path (generalize the single authorized
escrow into an allowlist of settlement adapters) before the deadline. High-confidence finding:

- The system's only real economic cost — the **2% `FEE_BPS` burn** — and the **self-deal guard
  (`provider != client`)** live in `escrow.rs`, **not** in `reputation.rs`.
- `record_settlement(provider, client_id, amount)` trusts the `amount` argument; its only check is
  `caller == authorized source`.
- An allowlist authorizes **who** may write but proves nothing about **what** they write being
  value-backed. A malicious/fake adapter could mint `score_bps` for free (zero tokens moved, zero
  burn) — reintroducing exactly the bought-edge / self-deal / grief-laundering the per-edge cap and
  trust-conservation were built to stop.

So under a single escrow, "a settlement was recorded" is structurally equivalent to "real, fee-burned
value moved." Opening the write path severs that binding. **The write path stays frozen at single-escrow
for v1.** Multi-writer support is a v2 item gated on a **proof-of-burn** settlement proof (§7).

## 4. Architecture

```
                         reads ($0, public, permissionless)
   cred402 / x402 BUIDLs / any agent ───────────────┐
                                                     ▼
┌──────────────────────────────────────────────────────────────┐
│  ON-CHAIN (deployed on casper-test, FROZEN for v1)            │
│  IdentityRegistry · Escrow · ReputationEngine · Cep18         │
│  write path: ONLY the wired Escrow may record settlements     │
│  read path:  all &self views are public + free                │
└──────────────────────────────────────────────────────────────┘
                                                     ▲
   ┌─────────────────────────────────────────────────┘ writes
   │   (always route through the REAL escrow — burn must fire)
┌──┴───────────────────────────────────────────────────────────┐
│  OFF-CHAIN (this spec — TypeScript)                           │
│  casper-x402         x402 client + trust read + registry      │
│  apps/web            Next.js read dashboard + hero demo flow  │
└──────────────────────────────────────────────────────────────┘
```

### Components (each independently understandable + testable)

**A. `casper-x402` — the TypeScript package** (the adoption wedge)

> Package name resolved (§10): `casper-x402`, unscoped. The widest entry point in an empty
> ecosystem (no Casper x402 client exists; ~9 BUIDLs hand-roll the handshake). x402 is the
> traffic driver; the `trust` module is the differentiator a payer discovers through the same
> import. The product brand "Casper Agent Trust Layer" lives on in the repo + README.

| Module | What it does | Depends on |
|---|---|---|
| `x402` | Wraps `fetch`: on HTTP 402, parse `accepts[]`, build + sign the v2 `PaymentPayload` (casper-eip-712 typed data), attach `PAYMENT-SIGNATURE`, retry. | casper-js-sdk, casper-eip-712, Casper Facilitator |
| `trust` | Read-only trust queries over existing views. `checkTrust(agentId) → {trusted, score, ...}`, `getReputation(agentId) → full record`. Auto-invoked inside `pay()` when `minScore` is set. | RPC (CSPR.cloud), ReputationEngine + IdentityRegistry read methods |
| `registry` | `register(agentMeta)` and `attestSettlement(receipt)`. **v1: `attestSettlement` routes a real escrowed+settled job through the deployed Escrow** so the 2% burn fires — it is NOT a new permissionless writer. | Escrow `create_job`/`approve`, CEP-18 approve/transfer_from |

Public surface: `createCasperX402Client(config)`, `pay(request)`, `checkTrust(agentId)`,
`getReputation(agentId)`, `register(agentMeta)`, `attestSettlement(receipt)`.

x402 v2 wire requirements the client must honor: `x402Version` = integer `2`; field is **`amount`**
(not `maxAmountRequired`); `network` is CAIP-2 `casper:casper-test`; `PaymentPayload` is base64 in the
`PAYMENT-SIGNATURE` header; signature via casper-eip-712 typed data.

**B. `apps/web` — Next.js read dashboard + demo** (the submission artifact)
- Agent trust card over the public views: score, jobs completed, bond, status.
- Hero flow: register → hire → settle → score moves → `checkTrust` gates a payment.
- Visual/UI layer is **Bekir + Gemini** (standing rule); this spec's scope is the read-glue + SDK only.

**C. Demo video** — rides on the dashboard + hero flow. Mandatory submission requirement.

## 5. What stays untouched (frozen)

The 4 deployed contracts and their `wasm`. No contract redeploy for v1 (Casper tooling is WSL2-only;
a redeploy is costly and unnecessary). All new work is off-chain TypeScript over existing entrypoints.

## 6. Read surface (already sufficient — no on-chain additions required)

`ReputationEngine`: `get_summary(agent_id)` (ERC-8004 facade), `get_reputation(provider)`,
`score(provider)`, `pair_stat(provider, client_id)`.
`IdentityRegistry`: `get_agent`, `agent_exists`, `total_agents`, `find_owner`, `agent_uri`,
`get_agent_wallet`, `is_authorized_or_owner`. `Escrow`: `get_job`, `total_jobs`.

Optional ergonomics only (not required): a composite `trust_view(agent_id)` joining identity
status/bond with reputation score in one call; a named `trust_score` alias. Defer unless a redeploy
happens for another reason.

## 7. v2 roadmap (post-deadline, stated openly in the pitch)

1. **Multi-writer settlement** via an adapter allowlist (`set_escrow` → `authorize_settlement_source`,
   a `Mapping<Address,bool>`). The engine seam is the `(provider, client_id, amount)` tuple — adapters
   plug in without an engine redeploy.
2. **Proof-of-burn settlement proof** (NOT proof-of-transfer). A permissionless `SettlementProver`
   adapter must scale the score delta off **proven-burned** value, re-resolve both endpoints to distinct
   registered agents, and consume a replay nonce. Without a mandatory burn bound to the delta, the
   permissionless path is strictly weaker than the escrow and must not ship.
3. **Engine-local invariant restoration** (required before any open-write): move `provider != client_id`
   into `record_settlement`; bind every delta to a verifiable burn; close the bond-floor
   trust-conservation exemption with a global per-provider bootstrap budget; require client consent so
   `granted_out_bps` cannot be griefed; add score decay/clawback; time-lock bond against withdrawal
   while it backs recent edge-cap grants.

## 8. Risks (no time estimates — risk level only)

| Risk | Level |
|---|---|
| All of the off-chain surface (SDK, dashboard, demo) is greenfield; contracts are done. | high |
| x402 v2 handshake against Casper's sponsored Facilitator is unproven end-to-end (no reference client to crib from — that is the gap). A CAIP-2 id or amount-encoding mismatch fails silently. | medium |
| Temptation to ship open-write to look "more substrate-like" — reintroduces laundering on camera. Mitigation: hard-freeze the write path; sell openness via reads only. | medium |
| `attestSettlement` overpromising — must be scoped to "route a real escrowed job," not "push any settlement." | medium |
| Testnet x402 free quota (25/day) can starve a live demo — request sponsored access (support@cspr.cloud) early, or split verify/settle. | medium |
| WSL2-only contract tooling slows any forced hotfix. Bounded — contracts are frozen. | low |

## 9. Success criteria (verifiable)

1. A third party reads an agent's trust score via the SDK with **no wallet, no signed tx, no payment** → `checkTrust` returns a live score from testnet.
2. `pay()` completes a real x402 402-handshake against the Casper Facilitator and returns the paid response.
3. `pay({minScore})` **blocks** a payment to a below-threshold agent and **allows** one above → trust gating demonstrated.
4. Hero flow on the dashboard: register → hire → settle → the provider's on-chain score visibly moves → a subsequent `checkTrust` reflects it.
5. Demo video records criteria 1–4 end-to-end on live testnet.
6. Pitch explicitly frames write-path openness as a v2 proof-of-burn roadmap — no overpromise.

## 10. Resolved decisions (fresh-mind review, 2026-06-18)

1. **Build order — `trust` (read) → `x402` client → `registry` → dashboard → demo.**
   The `trust` read module ships first, even before x402. It is the lowest-risk, fastest-green
   work (pure read-only RPC against the deployed contracts — no wallet, no signing, no tx) and
   alone satisfies success criterion #1; it is also the dependency of `pay({minScore})` gating.
   The x402 client (medium risk — the Facilitator handshake is unproven) builds on top.

2. **Demo agent — hybrid: real transactions + a thin LLM decision layer.**
   A client-agent picks a provider, calls `checkTrust`, and `pay({minScore})` settles or refuses.
   Every transaction is real and deterministic; the LLM only drives the "look at trust, then
   decide" moment. This meets the buildathon's "meaningful AI agent integration" bar at low risk
   (the SDK already exposes `pay` + `checkTrust`). A fully autonomous multi-step agent is a v2 item
   — its non-determinism + Facilitator quota make it a poor fit for a live demo.

3. **No SSE indexer for v1 — read on demand.**
   The dashboard shows a handful of agent trust cards; each view live-queries `get_summary` +
   `get_agent` over CSPR.cloud RPC. "Score moved" in the hero flow = one re-query after the
   `approve` tx confirms. A CSPR.cloud SSE indexer (only needed for a real-time feed / many-agent
   dashboard) is deferred to v1.5 — no success criterion requires it, and SSE already cost us pain
   at deploy time (see `tasks/lessons.md`).

4. **Package name `casper-x402` (unscoped); publish to npm close to submission.**
   Unscoped wins the "owns the default import" adoption argument in an empty ecosystem (every
   `x402-casper` / `@x402/casper` name 404s today). Publish once it is working + tested, with a
   README and a runnable example — not a half-baked early `0.0.x`. The product brand stays
   "Casper Agent Trust Layer" (repo + README); the npm package is the adoption vehicle.

---

*Pitch line:* "The settled-payment trust layer for Casper agents — one deployed registry that is both a
polished, demoable escrow→reputation product and a free, permissionless trust oracle every x402 BUIDL
reads in one line via our SDK. Reputation is a projection of real, fee-burned settlements, not
self-reported feedback: the read surface is open to everyone today, while the write surface stays earned."
