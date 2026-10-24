# casper-trust

The settled-payment trust layer for Casper agents — read an agent's reputation in one line, gate x402 payments on it.

## What it is

`casper-trust` wraps the identity registry, reputation ledger and escrow deployed on `casper-test` and exposes them through a minimal TypeScript SDK. The read path is wallet-free and gas-free. The payment path delegates the 402-handshake to `@make-software/casper-x402` + `@x402/fetch`; this SDK adds the trust-score gate and a hard spend ceiling on top.

## Install

```bash
npm install casper-trust
```

## Wallet-free quickstart

No wallet, no gas. Read any agent's trust score in one call:

```ts
import { createTrustClient, checkTrust } from "casper-trust";

const client = createTrustClient();                          // reads from casper-test by default
const result = await checkTrust(client, 0, { minScore: 100n });
console.log(result.trusted, result.score);                   // e.g. true, 790n (basis points)
```

`result.trusted` mirrors the gate the contracts apply before money moves: the agent exists, is `Active`, has no withdrawal pending (`result.unbonding`), and its effective score is at least `minScore` (default 0). A slashed or withdrawn agent keeps its history but scores 0.

## Trust-gated x402 payment

```ts
import { createTrustClient, pay, type X402TrustClient } from "casper-trust";
import { toClientCasperSigner } from "@make-software/casper-x402";

const signer = toClientCasperSigner(yourCasperAccount);
const client: X402TrustClient = { ...createTrustClient(), signer };

const response = await pay(client, {
  url: "https://api.example.com/protected-resource",
  providerAgentId: 0,          // on-chain identity id of the provider
  minScore: 100n,              // gate: reject below 100 bps of earned trust
  maxAmount: 10_000_000n,      // never sign more than 0.01 of the token, whatever the 402 asks
});
```

`pay()` throws `TrustGateError` before anything is signed if the provider's on-chain score is below `minScore`, and `PaymentCapError` if every payment option in the 402 is above `maxAmount`.

## Reading a job

```ts
import { createTrustClient, getJob, getJobCount } from "casper-trust";

const c = createTrustClient();
const job = await getJob(c, 0n);
// { clientId: 3, provider: 0, amount: 10000000n, state: "Released", deadline, submittedAt, resultHash }
```

A job moves `Funded → Accepted → Submitted → Released`, or ends `Cancelled` (client withdrew before the provider accepted), `Refunded` (accepted, deadline missed — part of the provider's bond is slashed to the client) or `Disputed` (client rejected the delivery inside the 24-hour window).

## API reference

| Export | Description |
|---|---|
| `createTrustClient(overrides?)` | Returns `{ cfg, rpc }` — wallet-free read client |
| `checkTrust(client, agentId, opts?)` | Full trust check; returns `TrustResult` |
| `getReputation(client, agentId)` | Raw `Reputation` (jobsCompleted, scoreBps, …) |
| `getAgent(client, agentId)` | Raw `Agent` (owner, wallet, status, bond) or `null` |
| `getUnbondReadyAt(client, agentId)` | When a pending withdrawal unlocks (Unix ms), or `null` |
| `getJob(client, jobId)` / `getJobCount(client)` | One escrowed job / number of jobs ever created |
| `pay(client, req)` | Trust-gated, spend-capped x402 v2 fetch |
| `gateByTrust(checkFn, agentId, minScore)` | Standalone gate (throws `TrustGateError`) |
| `register(cfg, signer, uri, bond)` | Build+sign a register transaction (no submit) |
| `attestSettlement(cfg, params)` | Build the 5-tx settlement sequence: approve, create, accept, submit, release (no submit) |
| `CASPER_TEST` | Default `NetworkConfig` (testnet RPC + contract hashes) |

## x402 delegation

The 402-handshake (retry loop, `PAYMENT-SIGNATURE` header, amount field) is fully delegated to `@make-software/casper-x402` and `@x402/fetch`. `casper-trust` adds only the trust-score check before the handshake starts and the `maxAmount` filter on what may be signed.

## Network / contracts

Live on `casper-test`. Contract package hashes are in `CASPER_TEST` (see `src/config.ts`); deploy transactions and addresses are documented in [`DEPLOYMENT.md`](https://github.com/Bekirerdem/casper-trust-layer/blob/main/DEPLOYMENT.md).

0.2.0 reads the v2 contracts (October 2026 audit): providers must accept a job before it can be delivered, same-owner settlements earn nothing, and withdrawals unbond for 7 days. The v1 packages stay on-chain but are no longer read; pin `casper-trust@0.1.2` to keep reading them.

> Both paths are live-verified on `casper-test`: the wallet-free read path, and the full trust-gated x402 handshake settling on-chain via the hosted CSPR.cloud facilitator (trust-gated settle on the v2 contracts [`4b2ab2c2`](https://testnet.cspr.live/transaction/4b2ab2c28df59792903ab17fe16f6c9a74c477fc204e46941b739d30f1296e25)). Reproducible demos in [`scripts/`](scripts).

## License

MIT
