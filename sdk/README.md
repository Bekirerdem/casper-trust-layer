# casper-trust

The settled-payment trust layer for Casper agents — read an agent's reputation in one line, gate x402 payments on it.

## What it is

`casper-trust` wraps three on-chain contracts (identity registry, reputation ledger, escrow) deployed on `casper-test` and exposes them through a minimal TypeScript SDK. The read path is wallet-free and gas-free. The payment path delegates the 402-handshake to `@make-software/casper-x402` + `@x402/fetch`; this SDK adds the trust-score gate on top.

## Install

```bash
npm install casper-trust
```

## Wallet-free quickstart

No wallet, no gas. Read any agent's trust score in one call:

```ts
import { createTrustClient, checkTrust } from "casper-trust";

const client = createTrustClient();              // reads from casper-test by default
const result = await checkTrust(client, 1);      // agentId = 1
console.log(result.trusted, result.score);       // e.g. true, 9500n (basis points)
```

`result.trusted` is `true` when the agent is Active and `score >= minScore` (default 0).

## Trust-gated x402 payment

```ts
import { createTrustClient, pay, type X402TrustClient } from "casper-trust";
import { toClientCasperSigner } from "@make-software/casper-x402";

const signer = toClientCasperSigner(yourCasperAccount);
const client: X402TrustClient = { ...createTrustClient(), signer };

const response = await pay(client, {
  url: "https://api.example.com/protected-resource",
  providerAgentId: 1,   // on-chain identity id of the provider
  minScore: 5000n,      // gate: reject if score < 50 % (basis points)
});
```

`pay()` throws `TrustGateError` before sending any money if the provider's on-chain score is below `minScore`.

## API reference

| Export | Description |
|---|---|
| `createTrustClient(overrides?)` | Returns `{ cfg, rpc }` — wallet-free read client |
| `checkTrust(client, agentId, opts?)` | Full trust check; returns `TrustResult` |
| `getReputation(client, agentId)` | Raw `Reputation` (jobsCompleted, scoreBps, …) |
| `getAgent(client, agentId)` | Raw `Agent` (owner, wallet, status, bond) or `null` |
| `pay(client, req)` | Trust-gated x402 v2 fetch |
| `gateByTrust(checkFn, agentId, minScore)` | Standalone gate (throws `TrustGateError`) |
| `register(cfg, signer, uri, bond)` | Build+sign a register transaction (no submit) |
| `attestSettlement(cfg, params)` | Build the 4-tx settlement sequence (no submit) |
| `CASPER_TEST` | Default `NetworkConfig` (testnet RPC + contract hashes) |

## x402 delegation

The 402-handshake (retry loop, `PAYMENT-SIGNATURE` header, amount field) is fully delegated to `@make-software/casper-x402` and `@x402/fetch`. `casper-trust` adds only the trust-score check before the handshake starts.

## Network / contracts

Live on `casper-test`. Contract package hashes are in `CASPER_TEST` (see `src/config.ts`) and documented with their field-index calibration in `.git/sdd/task-3-report.md` and `DEPLOYMENT.md`.

> The wallet-free read path is live-verified against testnet. The full x402 payment handshake is unit-tested at the gating level; an end-to-end live run against a funded facilitator token is tracked in the demo task.

## License

MIT
