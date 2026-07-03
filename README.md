<div align="center">

<img src="web/public/logo.png" alt="Casper Trust Layer" width="104" height="104" />

# Casper Agent Trust Layer

**On-chain trust infrastructure for autonomous agents on Casper** — where reputation is *earned from settled, paid work*, not self-reported, and **x402 payments are gated on it**.

</div>

[![live demo](https://img.shields.io/badge/live%20demo-online-2ea44f)](https://casper-trust-layer.vercel.app)
[![npm](https://img.shields.io/npm/v/casper-trust?label=casper-trust&color=cb3837)](https://www.npmjs.com/package/casper-trust)
[![contracts](https://img.shields.io/badge/OdraVM%20tests-50%20passing-2ea44f)](contracts/src)
[![sdk](https://img.shields.io/badge/SDK%20tests-66%20passing-2ea44f)](sdk/test)
[![network](https://img.shields.io/badge/casper--test-deployed-blue)](DEPLOYMENT.md)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

🔗 **[Live demo](https://casper-trust-layer.vercel.app)** · 📦 **[npm: casper-trust](https://www.npmjs.com/package/casper-trust)** · ⛓️ **[On-chain proof](DEPLOYMENT.md)**

> Built for the **Casper Agentic Buildathon 2026** · Contracts live on `casper-test` ([proof](DEPLOYMENT.md)) · SDK live on [npm](https://www.npmjs.com/package/casper-trust) · x402 settlement [verified on-chain](#live-proof)

---

## The gap we close

The canonical agent-trust standard (ERC-8004) stores reputation as **subjective client feedback** — anyone can post an arbitrary score with *zero proof they ever transacted with the agent*. On-chain, the score is just a plain mean of those self-reports. It is trivially Sybil- and wash-gameable.

**Our wedge:** reputation is a **projection of settled escrow jobs**. A score only moves when a real CEP-18 payment settles between two bonded agents — so fabricating reputation costs real money. We keep the ERC-8004 *read* surface (`get_summary`) for ecosystem compatibility, but the *source of truth* is objective, payment-backed settlement. That score then becomes a **payment gate**: agents pay each other over x402 only when the counterparty's earned trust clears the bar.

## How it works

```
┌─────────────────┐   register (bond)    agent identity (u32, transferable)
│ IdentityRegistry │◄──────────────────── ERC-8004 surface: agent_uri, wallet,
└─────────────────┘                        find_owner, total_agents, is_authorized
        ▲  resolve wallet / slash bond
        │
┌─────────────────┐   client hires provider (CEP-18 locked)
│      Escrow      │   submit → approve → settle (pay wallet, 2% protocol fee)
└─────────────────┘   deadline default → refund client + slash provider
        │  record_settlement(provider, client, amount)
        ▼
┌─────────────────┐   objective, sybil-resistant reputation
│ ReputationEngine │   Δscore = value × counterparty-weight × repeat-dampening
└─────────────────┘            bounded by per-edge cap + trust conservation
```

**The trust loop:** register an agent → a client agent hires it (funds escrow) → provider delivers → client approves → funds settle to the provider and reputation accrues to its *identity* (not a bare wallet, so it survives transfers). All in a single transaction via cross-contract calls.

## The payment layer — trust-gated x402

On-chain trust is only useful if something *acts* on it. The [`casper-trust`](https://www.npmjs.com/package/casper-trust) TypeScript SDK turns the registry into a live payment gate:

- **Wallet-free, gas-free reads.** Any agent's score is read by decoding contract storage directly over RPC — no wallet, no transaction. One line: `checkTrust(client, agentId)`.
- **Trust-gated x402 payments.** `pay()` reads the provider's on-chain score *before* spending a cent. Below the bar → `TrustGateError`, nothing leaves the wallet. Above the bar → a real x402 v2 handshake settles on-chain via the hosted CSPR.cloud facilitator.
- **Native to AI agents via MCP.** [`casper-trust-mcp`](mcp/) exposes `check_trust` / `get_reputation` / `get_agent` as MCP tools, so Claude, Cursor, or any MCP client can ask *"should I pay this agent?"* against live chain state before spending.

```ts
import { createTrustClient, pay } from "casper-trust";
import { toClientCasperSigner } from "@make-software/casper-x402";

const client = { ...createTrustClient(), signer: toClientCasperSigner(account) };

await pay(client, {
  url: "https://api.example.com/premium",
  providerAgentId: 0,   // on-chain identity of the seller
  minScore: 5000n,      // require ≥ 50% earned trust (basis points)
});
// → checks on-chain reputation → 402 → EIP-712 sign → facilitator /verify + /settle → 200
```

The 402-handshake itself (retry loop, `PAYMENT-SIGNATURE` header, `transfer_with_authorization`) is delegated to `@make-software/casper-x402` + `@x402/fetch`; `casper-trust` adds the on-chain trust gate on top. Payment settles in **WCSPR** (CEP-3009 `transfer_with_authorization`), with the facilitator paying gas.

## Reputation formula (the brain)

Every term is **unsigned-integer / basis-point math, O(1) per settlement** — no floats, no per-call history iteration. Designed against a red-team sweep (12 adversarial checks); full derivation in [`docs/reputation-formula.md`](docs/reputation-formula.md).

| Mechanism | Resists |
|---|---|
| `value = isqrt(amount)` (concave) | whale inflation + micro-job Sybil farming |
| `counterparty_weight` (saturating on the payer's *earned* score) | Sybil swarms — zero-rep payers contribute ≈ 0 |
| `repeat_dampening = max(floor, 10000/(1+k))` (per pair) | wash trading, without punishing legit repeat business |
| **per-edge lifetime cap** | **bought-edge / star laundering** (the attack a naive 3-factor formula fails) |
| **trust conservation** | a payer can't confer more reputation than it earned |
| bonded-newcomer **cold-start floor** (gated + capped) | the multiply-by-zero bootstrap deadlock — without letting bonds buy rank |
| escrow **protocol fee** (2%, permanently locked in escrow) + bond **slashing** | making fake reputation cost > benefit (cryptoeconomic security) |

### "Paid ≠ good work?"

The strongest objection to settlement-derived reputation: a payment proves the work was *paid for*, not that it was *good*. Fair — and answered by the design. Settlement here is **approval-gated**: funds only move when the *client* calls `approve`, so every score-moving settlement is a counterparty's costly endorsement — it permanently locks the 2% protocol fee — not a provider's self-report. A dissatisfied client simply doesn't approve, and reclaims the funds after the deadline.

- **The alternatives reintroduce a trusted writer.** LLM-jury verdicts and "trusted verifier" roles let whoever controls the judge mint subjective scores for free. Here, score can only be minted by pushing real value through escrow and giving up the fee.
- **A dishonest pair is bounded, not trusted.** Even a counterparty that *always* approves can only fabricate a capped, capital-linear amount of score — per-edge lifetime caps, trust conservation, and `isqrt` value concavity bound every edge ([full math](docs/reputation-formula.md)).

## Live proof

Everything below is live on `casper-test` — see [`DEPLOYMENT.md`](DEPLOYMENT.md) for all addresses and transaction proofs.

**Contracts**

| Contract | Package hash |
|---|---|
| IdentityRegistry | [`3a51cc5f…`](https://testnet.cspr.live/contract-package/3a51cc5f4c524f806b3b8899039030bbad141005f81ab99895615d8f050c7adc) |
| ReputationEngine | [`d73fb111…`](https://testnet.cspr.live/contract-package/d73fb11144c07ec05071cf986ad65b407f2da91bd871b0c10f67a974832ee7eb) |
| Escrow | [`fe6b0ddb…`](https://testnet.cspr.live/contract-package/fe6b0ddb307549cc9101659abcfaf114e37a8d99461c0632cbce582ebdc4902c) |
| AgentTreasury | [`abbdbdfd…`](https://testnet.cspr.live/contract-package/abbdbdfd40fc241983efda0d42efabdc2b919d6b94fe1e2849e98d6e640e763c) |
| Cep18 (demo token) | [`f962076e…`](https://testnet.cspr.live/contract-package/f962076e6c2ba423aaade9f75935ff37ef4aa4cde6077bac9a259af141c3d5c6) |

> **AgentTreasury** gives a business a *capped spending envelope* for an AI agent: the contract enforces per-task (100 AGT) + daily (500 AGT) limits and a **protocol-level reputation gate** — funds only release to a payee that is whitelisted **or** clears a `ReputationEngine.score` threshold. Trust enforced in the contract, not the SDK.

**End-to-end runs** (reproducible via [`sdk/scripts/network-boost.mts`](sdk/scripts) + the x402 demos)

A live **4-agent trust network** on `casper-test`: reputation flows from *multiple* counterparties, not a single loop. Agent #0 earned **408 bps over 6 settled jobs**; every row below is independently verifiable.

| What it proves | Transaction |
|---|---|
| Cross-edge settle — agent #2 → #0 lifts score `208 → 308` | [`6a7d54e8…`](https://testnet.cspr.live/transaction/6a7d54e8f257b54b85e1a68940115d2190f9c54c2b865c49821c7d183b190b69) |
| Cross-edge settle — agent #3 → #0 lifts score `308 → 408` | [`9e490f62…`](https://testnet.cspr.live/transaction/9e490f62c0efcd32acdbb813f601047b6c5d3468e36738d14af7cf15481da13a) |
| Bootstrap — agent #0 vouches for new agent #2 (`0 → 100`) | [`b5d6c3b9…`](https://testnet.cspr.live/transaction/b5d6c3b91efdcecf858bcaa55fba0804f7f2ccde1199ba1a5f9affa735edc591) |
| x402 handshake settles on-chain | [`0c58d79a…`](https://testnet.cspr.live/transaction/0c58d79ae9c595b4f9615bb505512bfaaf745c0e3da4f0808d6b197bcaec3c6e) |
| **Trust-gated x402** — paid only when score clears the bar | [`b4a4635f…`](https://testnet.cspr.live/transaction/b4a4635fd7611396c152d904c402ef9c6fcaa876c83fbf8b1429e1d9fb0225e3) |

> The trust-gated demo runs the *same* provider and endpoint twice: a bar above its earned score is **refused before any payment**; a bar it meets **settles on-chain**.

### Verify it yourself

No claim in this README requires trusting us:

| Claim | How to check |
|---|---|
| Agent #0 holds **408 bps over 6 settled jobs** | `curl https://casper-trust-layer.vercel.app/api/trust/0` → `{"agentId":0,"scoreBps":408,"jobsCompleted":6,"exists":true}` — a live, wallet-free storage read |
| The score came from real settlements, not writes we control | Settlement txs [`6a7d54e8…`](https://testnet.cspr.live/transaction/6a7d54e8f257b54b85e1a68940115d2190f9c54c2b865c49821c7d183b190b69) and [`9e490f62…`](https://testnet.cspr.live/transaction/9e490f62c0efcd32acdbb813f601047b6c5d3468e36738d14af7cf15481da13a) route through the deployed Escrow |
| x402 payment is actually trust-gated | [`b4a4635f…`](https://testnet.cspr.live/transaction/b4a4635fd7611396c152d904c402ef9c6fcaa876c83fbf8b1429e1d9fb0225e3) — the same endpoint is refused below the bar, settled above it |
| All 5 contracts are live and wired | Package hashes in the table above; every install + wiring transaction linked in [`DEPLOYMENT.md`](DEPLOYMENT.md) on [testnet.cspr.live](https://testnet.cspr.live) |
| The SDK is public and installable today | [`npm install casper-trust`](https://www.npmjs.com/package/casper-trust) |
| The code does what we say | `cargo odra test` in `contracts/` (50 tests) · `npx vitest run` in `sdk/` (66 tests incl. live read assertions) |

## Judging criteria at a glance

| Criterion | What ships | Evidence |
|---|---|---|
| **Technical quality** | 5 contracts live and wired on `casper-test`; 50 OdraVM tests (incl. the adversarial reputation suite) + 66 SDK tests | [`DEPLOYMENT.md`](DEPLOYMENT.md) · [`contracts/src`](contracts/src) · [`sdk/test`](sdk/test) |
| **Innovation** | Reputation derived *objectively* from settled escrow payments, hardened with anti-gaming math (per-edge caps, trust conservation, value concavity); to our knowledge the category's only npm-published SDK | [`docs/reputation-formula.md`](docs/reputation-formula.md) · [npm](https://www.npmjs.com/package/casper-trust) |
| **AI agent integration** | Trust-gated x402 `pay()` — an agent checks a counterparty's on-chain trust before spending a cent — plus the [`casper-trust-mcp`](mcp/) server so Claude/Cursor query trust natively | [payment layer](#the-payment-layer--trust-gated-x402) · [gated-settle tx](https://testnet.cspr.live/transaction/b4a4635fd7611396c152d904c402ef9c6fcaa876c83fbf8b1429e1d9fb0225e3) |
| **DeFi / RWA applicability** | AgentTreasury — a capped on-chain spending envelope (per-task + daily) with a protocol-level reputation gate; CEP-18 escrow rails | [AgentTreasury](https://testnet.cspr.live/contract-package/abbdbdfd40fc241983efda0d42efabdc2b919d6b94fe1e2849e98d6e640e763c) · [`contracts/src`](contracts/src) |
| **UX** | Wallet-free, gas-free score reads; live console + dashboard; in-browser wallet-signed registration | [live demo](https://casper-trust-layer.vercel.app) · [live API](https://casper-trust-layer.vercel.app/api/trust/0) |
| **Working contracts** | All 5 deployed, wired, and exercised end-to-end: settlements, slashing, treasury pay | [`DEPLOYMENT.md`](DEPLOYMENT.md) |
| **Ecosystem impact** | A published npm package any Casper agent project can adopt; the Odra 2.8.1 → Condor deploy workarounds are documented for other teams | [npm](https://www.npmjs.com/package/casper-trust) · [`DEPLOYMENT.md`](DEPLOYMENT.md) · [`tasks/lessons.md`](tasks/lessons.md) |

## Quick start

### Use the SDK (wallet-free, no setup)

```bash
npm install casper-trust
```

```ts
import { createTrustClient, checkTrust } from "casper-trust";

const client = createTrustClient();               // reads casper-test by default
const { trusted, score } = await checkTrust(client, 0);
console.log(trusted, score);                       // true, 100n (basis points)
```

### Run the live demos

```bash
cd sdk && npm install
npx vite-node scripts/trust-gated-x402.mts          # refuse-below-bar, settle-above-bar
npx vite-node scripts/x402-handshake.mts            # raw 402 → on-chain settle
```

### Build & deploy the contracts

Casper contract tooling runs on Linux; on Windows use WSL2 (see [`tasks/lessons.md`](tasks/lessons.md)).

```bash
cd contracts
cargo odra test                 # 50 passing on the OdraVM (no node needed)

export PATH=~/binaryen-latest/bin:$PATH
cargo odra build                # -> Casper-VM-compatible wasm/*.wasm (needs wabt + binaryen v130+)

cargo run --bin contracts_cli -- deploy   # see contracts/.env.example
```

## Project structure

```
contracts/
  src/identity.rs        IdentityRegistry  — ERC-8004 identity + bond + slash
  src/escrow.rs          Escrow            — A2A job state machine, CEP-18, 2% protocol fee
  src/reputation.rs      ReputationEngine  — escrow-derived sybil-resistant score
  src/treasury.rs        AgentTreasury     — capped spend envelope + on-chain reputation gate
  bin/cli.rs             odra-cli deploy script (5 contracts + wiring)
  vendor/                patched odra-casper-rpc-client (Casper 2.0/Condor deploy fix)
sdk/
  src/                   casper-trust TypeScript SDK (published to npm)
  scripts/               live demos: hero-loop, x402-handshake, trust-gated-x402, network-boost
  test/                  66 offline tests + live read assertions
web/                     Next.js landing + live trust dashboard (deployed on Vercel)
docs/reputation-formula.md   research-grounded formula design + threat model
tasks/                       build log + hard-won lessons
DEPLOYMENT.md                live addresses + tx proofs
```

## Tech stack

- **Contracts:** [Odra 2.8](https://odra.dev) (Rust → `wasm32-unknown-unknown` → Casper 2.0)
- **Token:** CEP-18 (`odra-modules`); payments in WCSPR (CEP-3009 `transfer_with_authorization`)
- **SDK:** TypeScript · `casper-js-sdk` 5 · `@make-software/casper-x402` · `@x402/fetch` — published as [`casper-trust`](https://www.npmjs.com/package/casper-trust)
- **Payments:** x402 v2 over the hosted [CSPR.cloud facilitator](https://x402-facilitator.cspr.cloud) (gasless for the payer)
- **Testing:** OdraVM (50 contract tests incl. adversarial reputation cases) + Vitest (66 SDK tests)
- **Deploy:** `cargo-odra` + cspr.cloud (via a small auth proxy), patched for the Condor account model

## Launch plan

**Already shipped** — distribution is live, not hypothetical: [`casper-trust`](https://www.npmjs.com/package/casper-trust) is installable from npm today; the [live dashboard](https://casper-trust-layer.vercel.app) exposes the registry to anyone, no wallet required; the in-browser [hire flow](https://casper-trust-layer.vercel.app/app) lets any visitor fund → deliver → approve and watch a score move on-chain; and [`casper-trust-mcp`](mcp/) plugs on-chain trust into Claude/Cursor.

**Qualification → final**

- Publish `casper-trust-mcp` to npm (`npx casper-trust-mcp`)
- AgentTreasury support in the SDK (bounded spend + reservations)

**Mainnet path** — three blockers, in order:

1. **Agent-side key management hardening** — operational wallets currently hold raw signing keys
2. **A stable payment token** — settlement runs on WCSPR / a demo CEP-18 today; production needs a stable, liquid token so reputation weight isn't coupled to price volatility
3. **v2 contract hardening** — the accepted-risk fixes documented in the [threat model](docs/reputation-formula.md) (§7): provider consent on job creation, proportional slashing, treasury status gate, reputation decay, dynamic bonds

**Community** — building in public on X and [CSPR.fans](https://cspr.fans); the deploy workarounds in [`tasks/lessons.md`](tasks/lessons.md) are already reusable by other Casper teams.

## Notes

The contract code is unmodified vanilla Odra. Three workarounds were needed for an Odra 2.8.1 → Casper 2.2.1 (Condor) **testnet deploy** (a cspr.cloud auth proxy, a patched contract-address resolver, and a resilient SSE watcher) — all documented in [`tasks/lessons.md`](tasks/lessons.md) and [`DEPLOYMENT.md`](DEPLOYMENT.md).

## License

MIT — see [LICENSE](LICENSE).
