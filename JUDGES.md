# Judges — verify the whole thing in 10 minutes

No marketing on this page. Five checks, in order of effort. The first three need
**no wallet, no key, no install, no gas** — because reads here are wallet-free by
design, which is the point of the project.

Every number below is read live from `casper-test`. If a score reads *higher*
than what's printed here, that's expected: the network is live and still settling.

---

## 1 · Read an agent's on-chain reputation — 30 seconds, zero setup

```bash
curl https://casper-trust-layer.vercel.app/api/trust/0
```

```json
{"agentId":0,"scoreBps":508,"jobsCompleted":7,"exists":true}
```

That is not a database row. The endpoint decodes `ReputationEngine` contract
storage over RPC on every request ([`web/lib/casper/read.ts`](web/lib/casper/read.ts)).
Swap `0` for any agent id, or read the whole registry at once:

```bash
curl https://casper-trust-layer.vercel.app/api/trust/all
```

## 2 · Confirm the score came from real settlements — 2 minutes

The score only moves when a CEP-18 payment settles through `Escrow` between two
bonded agents. Open any of these and read the transaction yourself:

| What it proves | Transaction |
|---|---|
| Cross-edge settle — agent #2 → #0 lifts `208 → 308` | [`6a7d54e8…`](https://testnet.cspr.live/transaction/6a7d54e8f257b54b85e1a68940115d2190f9c54c2b865c49821c7d183b190b69) |
| Cross-edge settle — agent #3 → #0 lifts `308 → 408` | [`9e490f62…`](https://testnet.cspr.live/transaction/9e490f62c0efcd32acdbb813f601047b6c5d3468e36738d14af7cf15481da13a) |
| A browser visitor's own hire flow settled `100 → 200` | [`04cea776…`](https://testnet.cspr.live/transaction/04cea776e694eb6aa33ec117c9572a9574979999e62340122b159f976a3490ce) |
| x402 payment **refused below the bar, settled above it** | [`b4a4635f…`](https://testnet.cspr.live/transaction/b4a4635fd7611396c152d904c402ef9c6fcaa876c83fbf8b1429e1d9fb0225e3) |

All five contract packages and every wiring transaction: [`DEPLOYMENT.md`](DEPLOYMENT.md).

## 3 · Make the contract refuse a payment — 2 minutes, still no wallet

Open the [**Trust Console**](https://casper-trust-layer.vercel.app/app). The top
panel is the owner's spending envelope, read live from `AgentTreasury`: a
per-task cap, a daily cap, and the counterparty bar.

Under it, press any of the three buttons. Each one submits a **real transaction**
and the contract decides:

| Attempt | What the contract does |
|---|---|
| Pay a **proven** counterparty (508 bps) | settles |
| Pay an **unproven** one (0 bps) | reverts — `BelowReputationThreshold` |
| Pay **over the per-task cap** | reverts — `ExceedsTaskLimit` |

A rejection costs gas and is written to the chain, which is what makes it
evidence rather than a claim. Both verdicts link to cspr.live.

**The brake.** The owner can halt every outflow with one call, without moving a
token. Proven on-chain, same payment either side of it:

| | Transaction |
|---|---|
| Payment settles | [`8040d00f…`](https://testnet.cspr.live/transaction/8040d00f38a9288bf1aa11fb28efb1e693fd8a5532abf4bb47e836b2e13e9974) |
| Owner calls `pause()` | [`d9e87d8a…`](https://testnet.cspr.live/transaction/d9e87d8a0bfb1dc4d5580b8e40917bfce82d2c95790531e38fe56afaad2003c7) |
| **The same payment now reverts** (`Paused`) | [`c96cf67d…`](https://testnet.cspr.live/transaction/c96cf67dabaeb2eb3462278fc2ccc60cd6a14aa604be0dc2775bccf108ffdff8) |
| `unpause()` → settles again | [`e03063e3…`](https://testnet.cspr.live/transaction/e03063e3c7c74efc75ce5ac9a9bf4ed6fa42986183573d6214429d5159d39319) |

Also on the [landing page](https://casper-trust-layer.vercel.app): the *Try It*
section moves a `minScore` slider against a live agent and flips the gate between
`APPROVED` and `REFUSED` — the same decision `pay()` makes before spending a cent.

## 4 · Integrate it — 3 minutes

The category's only npm-published SDK. Wallet-free, works in plain Node:

```bash
npm install casper-trust
```

```js
import { createTrustClient, checkTrust } from "casper-trust";

const result = await checkTrust(createTrustClient(), 0, { minScore: 100n });
console.log(result);
// { agentId: 0, exists: true, trusted: true, score: 508n,
//   jobsCompleted: 7n, status: 'Active', bond: 10000000000n }
```

And the gate that acts on it — one call, refuses before any money moves:

```js
await pay(client, { url, providerAgentId: 0, minScore: 5000n });
// below the bar → TrustGateError, nothing leaves the wallet
// above the bar → real x402 v2 handshake, settles on-chain
```

AI agents get the same reads as MCP tools via [`mcp/`](mcp/) — `check_trust`,
`get_reputation`, `get_agent`.

## 5 · Move a score yourself — 5 minutes, needs Casper Wallet

In the [Trust Console](https://casper-trust-layer.vercel.app/app), connect a
Casper Wallet on testnet:

1. **Register your agent** — posts a CSPR bond, signed by your wallet, on-chain.
2. **Get test AGT** — built-in faucet, one click.
3. **Hire an agent** — funds lock in escrow → the provider delivers → you
   approve → payment settles and **the provider's score changes on-chain, from
   a transaction you signed**.

Every step returns a transaction hash linked to cspr.live. Nothing is simulated.

---

## What to look at if you only have two minutes

**The one-sentence claim:** here, *no judge decides reputation — the payment
does*. There is no LLM jury, no validator committee, no trusted verifier role
anywhere in the scoring path. A score can only move when real capital settles
through escrow and the paying client calls `approve`, permanently locking a 2%
protocol fee. That makes fabricating reputation cost money rather than cost a
prompt.

Everything else follows from that choice:

| | Typical agent-trust design | **Casper Trust Layer** |
|---|---|---|
| Who sets the score | Self-reports, an LLM judge, or a staked validator set | A settled CEP-18 payment — nobody |
| Cost to fake a score | Zero, or the cost of running a model | Real capital: locked protocol fee + bond at risk |
| Failure mode | Whoever controls the judge mints trust for free | Bounded: per-edge caps + trust conservation ([math](docs/reputation-formula.md)) |
| Acting on trust | Read-only registry | `pay({ minScore })` — refuses before a cent moves |

**Reproduce the tests:**

```bash
cd contracts && cargo odra test    # 50 OdraVM tests, incl. the adversarial reputation suite
cd sdk && npm install && npx vitest run    # 66 SDK tests, incl. live-read assertions
```

**Judging criteria → evidence** is mapped line by line at the bottom of the
[README](README.md#judging-criteria-at-a-glance).
