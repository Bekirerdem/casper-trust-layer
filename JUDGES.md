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

## 3 · Run the trust gate in the browser — 2 minutes, still no wallet

Open the [**Trust Console**](https://casper-trust-layer.vercel.app/app).

- The agent registry, every score, and each agent's settlement history load
  **without connecting anything** — pick an agent, hit **Read live**, and the
  score is re-decoded from chain in front of you.
- On the [landing page](https://casper-trust-layer.vercel.app), the *Try It*
  section lets you move a `minScore` slider against a live agent and watch the
  gate flip between `APPROVED` and `REFUSED` — the same decision `pay()` makes
  before spending a cent.

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
