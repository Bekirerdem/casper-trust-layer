# Judges — verify the whole thing in 10 minutes

No marketing on this page. Five checks, in order of effort. The first three need
**no wallet, no key, no install, no gas** — because reads here are wallet-free by
design, which is the point of the project.

Every number below is read live from `casper-test`, from the **v2 contracts**
(the audited rewrite, installed 2026-10-23 — see [`DEPLOYMENT.md`](DEPLOYMENT.md)).
If a score reads *higher* than what's printed here, that's expected: the network
is live and still settling.

---

## 1 · Read an agent's on-chain reputation — 30 seconds, zero setup

```bash
curl https://casper-trust-layer.vercel.app/api/trust/0
```

```json
{"agentId":0,"scoreBps":790,"jobsCompleted":3,"exists":true}
```

That is not a database row. The endpoint decodes `ReputationEngine` contract
storage over RPC on every request ([`web/lib/casper/read.ts`](web/lib/casper/read.ts)).
Swap `0` for any agent id, or read the whole registry at once:

```bash
curl https://casper-trust-layer.vercel.app/api/trust/all
```

## 2 · Confirm the score came from real settlements — 2 minutes

The score only moves when a CEP-18 payment settles through `Escrow` between two
bonded agents **with different owners** — the provider having accepted the job
first. Open any of these and read the transaction yourself:

| What it proves | Transaction |
|---|---|
| First settlement — client #3 → provider #0 lifts `0 → 316` | [`1fa8296f…`](https://testnet.cspr.live/transaction/1fa8296f1ffb538eb9969dcba74a046a69f15e36bf0173e03efd11afd92c25d8) |
| A second, unrelated client — #4 → #0 lifts `316 → 632` | [`2e09f49f…`](https://testnet.cspr.live/transaction/2e09f49fb67eac420342d7bb52b01a04dd8cfaefd44b53e96a79f76f49316550) |
| The same client again — dampened to half, `632 → 790` | [`19d6466f…`](https://testnet.cspr.live/transaction/19d6466fbcc42ec289b74b36a9277f0668c4e48dd717b3e5619d2fee53f5b3a0) |
| x402 payment **refused below the bar, settled above it** — #0 at 790 bps | [`4b2ab2c2…`](https://testnet.cspr.live/transaction/4b2ab2c28df59792903ab17fe16f6c9a74c477fc204e46941b739d30f1296e25) |

All six contract packages and every wiring transaction: [`DEPLOYMENT.md`](DEPLOYMENT.md).

## 3 · Make the contract refuse a payment — 2 minutes, still no wallet

Open the [**Trust Console**](https://casper-trust-layer.vercel.app/app). The top
panel is the owner's spending envelope, read live from `AgentTreasury`: a
per-task cap, a cap over any rolling 24 hours, and the counterparty bar.

Under it, press any of the three buttons. Each one submits a **real transaction**
and the contract decides:

| Attempt | What the contract does |
|---|---|
| Pay a **proven** counterparty (790 bps) | settles |
| Pay an **unproven** one (0 bps) | reverts — `BelowReputationThreshold` |
| Pay **over the per-task cap** | reverts — `ExceedsTaskLimit` |

A rejection costs gas and is written to the chain, which is what makes it
evidence rather than a claim. Both verdicts link to cspr.live.

The same three outcomes, already on-chain, plus **the brake** — the owner halts
every outflow with one call, without moving a token:

| | Transaction |
|---|---|
| Proven payee — settles | [`f1dc429a…`](https://testnet.cspr.live/transaction/f1dc429a22d976b575d70cc52828e836bd7f65b4dfd1e6026a95f816968e9ca5) |
| Unproven payee — refused (`BelowReputationThreshold`) | [`60d9bef5…`](https://testnet.cspr.live/transaction/60d9bef5bcbb64b4993b329f46e2d3dc5ea8e7cad33899f3b3d4b8824baf0d3e) |
| Over the per-task cap — refused (`ExceedsTaskLimit`) | [`7fa2aff0…`](https://testnet.cspr.live/transaction/7fa2aff00477b2fa7ca473d57004d81cbd17ab6745558549218b52e0e2ef1205) |
| Owner calls `pause()` | [`e1d283b9…`](https://testnet.cspr.live/transaction/e1d283b9595080a559a66f061f512480a95f0b5fd6c98a1185171c41a6a49d6b) |
| **The same payment now reverts** (`Paused`) | [`95f94f2f…`](https://testnet.cspr.live/transaction/95f94f2f5731649d17db139159f5933a9a8b6cec6839b3b4c91e73514350b2c8) |
| `unpause()` | [`e0bc0ee3…`](https://testnet.cspr.live/transaction/e0bc0ee3c0de919eab3ae665ebe6a120dee19189322ddd7d4e16caefdeea1f70) |

Also on the [landing page](https://casper-trust-layer.vercel.app): the *Try It*
section moves a `minScore` slider against a live agent and flips the gate between
`APPROVED` and `REFUSED` — the same decision `pay()` makes before spending a cent.

**And it is per-customer, not one shared demo.** `AgentVaults`
([`4172ebf4…`](https://testnet.cspr.live/contract-package/4172ebf4438b14ac02dea598d62a95ec05bd6ea717426dc525209ae33b62eafd))
holds a separate vault for every owner — own rules, own balance, own freeze
switch, ownership checked on every state-changing call. Connect a wallet on the
dashboard and it looks for *your* vault; if you don't have one, you write the
limits and **you** sign the transaction that opens it. The server never signs on
your behalf.

One vault, exercised end to end — same payment, only the rule changes:

| | Transaction |
|---|---|
| Owner opens a vault with their own rules | [`ca02c150…`](https://testnet.cspr.live/transaction/ca02c15032ab558777fa5f528fd9d287b8b3d2bf152488f16c5b582b4d79bb6b) |
| Pays a vendor **with** a track record | [`417e6f81…`](https://testnet.cspr.live/transaction/417e6f816e9d46b7534f7e6e13f34484c8680d8a0ad3cf58e01ef7bc30850050) |
| Same payment, vendor **without** one — refused (`PayeeNotAllowed`) | [`4cca0d25…`](https://testnet.cspr.live/transaction/4cca0d25ed076e74e128d6f0da5f753407411228cae70cd541392639f647493b) |
| Owner freezes → the accepted payment now reverts (`Frozen`) | [`804b3e18…`](https://testnet.cspr.live/transaction/804b3e184cc5a91ccb0e9d0b019b0c117a03427a1df438a65a590ab1c0dc8920) |

Every one of these came out of [`sdk/scripts/seed-v2.mts`](sdk/scripts/seed-v2.mts).
The test that matters most is `a_stranger_cannot_touch_your_vault` — an outsider
can neither freeze, withdraw, re-rule nor spend from someone else's vault
(`contracts/src/vaults.rs`, 100 tests total).

## 4 · Integrate it — 3 minutes

Published to npm and installable right now — wallet-free, working in plain Node.
Install it in an empty directory and it runs; nothing here is a repo-only script:

```bash
npm install casper-trust
```

```js
import { createTrustClient, checkTrust } from "casper-trust";

const result = await checkTrust(createTrustClient(), 0, { minScore: 100n });
console.log(result);
// { agentId: 0, exists: true, trusted: true, score: 790n, jobsCompleted: 3n,
//   status: 'Active', bond: 10000000000n, unbonding: false }
```

And the gate that acts on it — one call, refuses before any money moves:

```js
await pay(client, { url, providerAgentId: 0, minScore: 100n, maxAmount: 10_000_000n });
// below the bar     → TrustGateError, nothing leaves the wallet
// priced above max  → PaymentCapError, nothing is signed
// otherwise         → real x402 v2 handshake, settles on-chain
```

AI agents get the same reads as MCP tools via [`casper-trust-mcp`](mcp/) —
`check_trust`, `get_reputation`, `get_agent` (`npx -y casper-trust-mcp`).

## 5 · Move a score yourself — 5 minutes, needs Casper Wallet

In the [Trust Console](https://casper-trust-layer.vercel.app/app), connect a
Casper Wallet on testnet:

1. **Register your agent** — posts a CSPR bond, signed by your wallet, on-chain.
2. **Get test AGT** — built-in faucet, one click.
3. **Hire a demo agent** — funds lock in escrow → the agent accepts the job (its
   bond is now at stake) → it delivers → you approve → payment settles and **the
   provider's score changes on-chain, from a transaction you signed**.

Every step returns a transaction hash linked to cspr.live. Nothing is simulated.

---

## What to look at if you only have two minutes

**The one-sentence claim:** here, *no judge decides reputation — the payment
does*. There is no LLM jury, no validator committee, no trusted verifier role
anywhere in the scoring path. A score can only move when real capital settles
through escrow between two different owners and the paying client calls
`approve`, paying a 2% protocol fee. That makes fabricating reputation cost money
rather than cost a prompt.

Everything else follows from that choice:

| | Typical agent-trust design | **Casper Trust Layer** |
|---|---|---|
| Who sets the score | Self-reports, an LLM judge, or a staked validator set | A settled CEP-18 payment — nobody |
| Cost to fake a score | Zero, or the cost of running a model | Real capital: protocol fee + bond at risk; self-dealing earns nothing |
| Failure mode | Whoever controls the judge mints trust for free | Bounded: per-edge caps + trust conservation ([math](docs/reputation-formula.md)) |
| Acting on trust | Read-only registry | `pay({ minScore })` — refuses before a cent moves |

**Reproduce the tests:**

```bash
cd contracts && cargo odra test    # 100 OdraVM tests, incl. a negative test per audit finding
cd sdk && npm install && npx vitest run    # 73 SDK tests; CASPER_LIVE=1 adds live-read assertions
```

**Judging criteria → evidence** is mapped line by line at the bottom of the
[README](README.md#judging-criteria-at-a-glance).
