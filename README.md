# Casper Agent Trust Layer

**On-chain trust infrastructure for autonomous agents on Casper** — where reputation is *earned from settled, paid work*, not self-reported.

[![tests](https://img.shields.io/badge/OdraVM%20tests-31%20passing-2ea44f)](contracts/src)
[![network](https://img.shields.io/badge/casper--test-deployed-blue)](DEPLOYMENT.md)
[![framework](https://img.shields.io/badge/Odra-2.8-orange)](https://odra.dev)
[![license](https://img.shields.io/badge/license-MIT-lightgrey)](LICENSE)

> Built for the **Casper Agentic Buildathon 2026** · Live on `casper-test` ([proof](DEPLOYMENT.md))

---

## The gap we close

The canonical agent-trust standard (ERC-8004) stores reputation as **subjective client feedback** — anyone can post an arbitrary score with *zero proof they ever transacted with the agent*. On-chain, the score is just a plain mean of those self-reports. It is trivially Sybil- and wash-gameable.

**Our wedge:** reputation is a **projection of settled escrow jobs**. A score only moves when a real CEP-18 payment settles between two bonded agents — so fabricating reputation costs real money. We keep the ERC-8004 *read* surface (`get_summary`) for ecosystem compatibility, but the *source of truth* is objective, payment-backed settlement.

## How it works

```
┌─────────────────┐   register (bond)    agent identity (u32, transferable)
│ IdentityRegistry │◄──────────────────── ERC-8004 surface: agent_uri, wallet,
└─────────────────┘                        find_owner, total_agents, is_authorized
        ▲  resolve wallet / slash bond
        │
┌─────────────────┐   client hires provider (CEP-18 locked)
│      Escrow      │   submit → approve → settle (pay wallet, 2% burn fee)
└─────────────────┘   deadline default → refund client + slash provider
        │  record_settlement(provider, client, amount)
        ▼
┌─────────────────┐   objective, sybil-resistant reputation
│ ReputationEngine │   Δscore = value × counterparty-weight × repeat-dampening
└─────────────────┘            bounded by per-edge cap + trust conservation
```

**The trust loop:** register an agent → a client agent hires it (funds escrow) → provider delivers → client approves → funds settle to the provider and reputation accrues to its *identity* (not a bare wallet, so it survives transfers). All in a single transaction via cross-contract calls.

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
| escrow **burn fee** + bond **slashing** | making fake reputation cost > benefit (cryptoeconomic security) |

## Live on Casper testnet

Deployed and wired on `casper-test` — see [`DEPLOYMENT.md`](DEPLOYMENT.md) for all addresses and `cspr.live` transaction proofs.

| Contract | Package hash |
|---|---|
| IdentityRegistry | [`3a51cc5f…`](https://testnet.cspr.live/contract-package/3a51cc5f4c524f806b3b8899039030bbad141005f81ab99895615d8f050c7adc) |
| ReputationEngine | [`d73fb111…`](https://testnet.cspr.live/contract-package/d73fb11144c07ec05071cf986ad65b407f2da91bd871b0c10f67a974832ee7eb) |
| Escrow | [`fe6b0ddb…`](https://testnet.cspr.live/contract-package/fe6b0ddb307549cc9101659abcfaf114e37a8d99461c0632cbce582ebdc4902c) |
| Cep18 (demo token) | [`f962076e…`](https://testnet.cspr.live/contract-package/f962076e6c2ba423aaade9f75935ff37ef4aa4cde6077bac9a259af141c3d5c6) |

## Quick start

Casper contract tooling runs on Linux; on Windows use WSL2 (see [`tasks/lessons.md`](tasks/lessons.md)).

```bash
# Toolchain: rustup nightly-2026-01-01 + wasm32-unknown-unknown, cargo install cargo-odra
cd contracts

# Run the full test suite on the OdraVM (no node needed)
cargo odra test                 # 31 passing

# Build deployable, Casper-VM-compatible WASM (needs wabt + binaryen v130+)
export PATH=~/binaryen-latest/bin:$PATH
cargo odra build                # -> wasm/*.wasm

# Deploy to testnet (see contracts/.env.example)
cargo run --bin contracts_cli -- deploy
```

## Project structure

```
contracts/
  src/identity.rs        IdentityRegistry  — ERC-8004 identity + bond + slash
  src/escrow.rs          Escrow            — A2A job state machine, CEP-18, burn fee
  src/reputation.rs      ReputationEngine  — escrow-derived sybil-resistant score
  bin/cli.rs             odra-cli deploy script (4 contracts + wiring)
  vendor/                patched odra-casper-rpc-client (Casper 2.0/Condor deploy fix)
docs/reputation-formula.md   research-grounded formula design + threat model
tasks/                       build log + hard-won lessons
DEPLOYMENT.md                live addresses + tx proofs
```

## Tech stack

- **Contracts:** [Odra 2.8](https://odra.dev) (Rust → `wasm32-unknown-unknown` → Casper 2.0)
- **Token:** CEP-18 (`odra-modules`)
- **Testing:** OdraVM (in-memory) — 31 tests incl. adversarial reputation cases
- **Deploy:** `cargo-odra` + cspr.cloud (via a small auth proxy), patched for the Condor account model

## Notes

The contract code is unmodified vanilla Odra. Three workarounds were needed for an Odra 2.8.1 → Casper 2.2.1 (Condor) **testnet deploy** (a cspr.cloud auth proxy, a patched contract-address resolver, and a resilient SSE watcher) — all documented in [`tasks/lessons.md`](tasks/lessons.md) and [`DEPLOYMENT.md`](DEPLOYMENT.md).

## License

MIT — see [LICENSE](LICENSE).
