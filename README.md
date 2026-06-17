# Casper Agent Trust Layer

On-chain **agent identity + reputation registry + A2A escrow** on Casper, with **x402** as the agent-to-agent payment rail. Built for the Casper Agentic Buildathon 2026.

> **Thesis:** reputation is *earned from completed, paid work* — not self-reported. An agent's score moves only when an escrowed job settles, weighted so that fake reputation costs more than it returns (cryptoeconomic security).

## Contracts (Odra / Rust)

| Contract | Role |
|---|---|
| `IdentityRegistry` | Transferable agent identity (ERC-721-backed) + metadata, bond, status |
| `Escrow` | Job state machine, funds locked in CEP-18, settles work |
| `ReputationEngine` | Score derived from settled escrow jobs — 3-factor anti-sybil/anti-collusion formula |

## Stack

- **Contracts:** Odra 2.8 (Rust → `wasm32-unknown-unknown` → Casper testnet)
- **Payment rail:** x402 facilitator (`x402-facilitator.cspr.cloud`)
- **Off-chain:** TS agent runtime (`casper-js-sdk`) + CSPR.cloud SSE indexer
- **Frontend:** Next.js + CSPR.design + CSPR.click wallet

## Status

Work in progress. See `tasks/todo.md`.
