# Deployment — Casper Testnet (`casper-test`)

The full Agent Trust Layer is deployed and wired on Casper testnet, deployed from
account `02035b3ea46df7a08c778d0ebfbe21f7ab2442030d038a7a55cd3058a452ba40f0c7`.

## v2 contracts (2026-10-23)

The audited rewrite (`contracts/CHANGELOG.md` [0.2.0]) is a fresh install — Odra has
no upgrade path. It reuses the v1 AGT token. The web app and SDK still read v1 until
their field indices are calibrated against these packages.

| Contract | Package hash | Install tx |
|---|---|---|
| **IdentityRegistry** | `contract-package-941380ecfa5771630eae4bf38f81c0801cfba085799932f55c094f43c0f44953` | [`99e39ff6…`](https://testnet.cspr.live/transaction/99e39ff6a9385ecf2e4842d1002d9fd76b225a0d8d2087221585e4527034badc) |
| **ReputationEngine** | `contract-package-276ae7d8d73b1c0c7e993b068d5cea50508b0a00848b06286530ed27fbe943fa` | [`7b26eed5…`](https://testnet.cspr.live/transaction/7b26eed5564f345c686a7973e179a59824e1949fba3c65764750d5c4891ec7ea) |
| **Escrow** | `contract-package-644486bf5b57376b3855157db10da977e61ab300867248c58dd15f33eb45ec27` | [`194e9200…`](https://testnet.cspr.live/transaction/194e9200b72a78f239e2652f4eb575d3fdfaabf08eabb54e2d0effc83651d2ee) |
| **AgentTreasury** | `contract-package-ef14ceacbb8cc6d20cf55225295a4f3d6e5ac5a996c94ad5fc56108337acda24` | [`6ba01956…`](https://testnet.cspr.live/transaction/6ba01956e50edf6425cee60e22fc6f12bced6948f21437dabfcc3bc265cfeb4a) |
| **AgentVaults** | `contract-package-4172ebf4438b14ac02dea598d62a95ec05bd6ea717426dc525209ae33b62eafd` | [`5055c92f…`](https://testnet.cspr.live/transaction/5055c92f531523220ff9dbfd9a7cebc68b3b6a6ca2021517c53153ab3396c787) |
| **Cep18 (AGT token)** | reused from v1 (`f962076e…`) | — |

| Wiring | tx |
|---|---|
| `IdentityRegistry.set_escrow(Escrow)` | [`d1f51f5a…`](https://testnet.cspr.live/transaction/d1f51f5a1bd1414813c1ca4f687862d5224acb7156ca316bf83368a0ad545402) |
| `ReputationEngine.set_escrow(Escrow)` | [`0a51fab2…`](https://testnet.cspr.live/transaction/0a51fab207bceb79c72294a398b3edf4a527bd55558f75c339772ea3ebf256b7) |
| `AgentTreasury.set_reputation_policy(ReputationEngine, 1)` | [`8f225869…`](https://testnet.cspr.live/transaction/8f2258694de59ca9e867afd491ffa94a8dd3c7260e492178f14c33ac224ed016) |

## v1 contracts (live in the web app)

| Contract | Package hash | Install tx |
|---|---|---|
| **AgentVaults** | `contract-package-674cc233514a5e478f84ea37d657cc6b58d41984b788778d6ca554e6615d6914` | [`0b63f448…`](https://testnet.cspr.live/deploy/0b63f44881646d71cb25cc907b0da1ff239646b6fcb4afda66c17396e8479039) |
| **IdentityRegistry** | `contract-package-3a51cc5f4c524f806b3b8899039030bbad141005f81ab99895615d8f050c7adc` | [`c4785dce…`](https://testnet.cspr.live/deploy/c4785dce13ed21998360a151cd4982a1dcdd0b290bafe11f10e9c165128cca08) |
| **ReputationEngine** | `contract-package-d73fb11144c07ec05071cf986ad65b407f2da91bd871b0c10f67a974832ee7eb` | [`bee038af…`](https://testnet.cspr.live/deploy/bee038aff4653c1921f0b677587939501251bfcbf7d287de533ffca08e77f5dd) |
| **Cep18 (AGT token)** | `contract-package-f962076e6c2ba423aaade9f75935ff37ef4aa4cde6077bac9a259af141c3d5c6` | [`48b28270…`](https://testnet.cspr.live/deploy/48b28270f9d07bde9301707ec6ec7228a592097c599c18f8071a9f4efbfd6156) |
| **Escrow** | `contract-package-fe6b0ddb307549cc9101659abcfaf114e37a8d99461c0632cbce582ebdc4902c` | [`29883be2…`](https://testnet.cspr.live/deploy/29883be2b9945370b2b824a4f3bf70bdfeaee04b18869438710f9fbdfd226309) |
| **AgentTreasury** (v2) | `contract-package-95a5cde87caeeee469f6708b4cdbb8ee6b74bf9a50bab429287cc1400ef32f1a` | deployed 2026-07-25 |

> **AgentVaults** is the multi-tenant one: a single contract holding a vault per
> customer (`owner · agent · per_job · per_day · min_track_record · balance ·
> frozen`), with ownership checked on every state-changing call. A factory —
> one contract per user — is the EVM pattern; on Casper it would bill every
> signup for a deployment, so tenancy lives inside the contract instead.
>
> **AgentTreasury v2** adds the owner's `pause()` / `unpause()`. Odra has no upgrade
> path, so this is a fresh install; v1
> (`contract-package-abbdbdfd40fc241983efda0d42efabdc2b919d6b94fe1e2849e98d6e640e763c`,
> install [`df27440d…`](https://testnet.cspr.live/deploy/df27440d5e0294aa03258103ae585f1aac41b403e1d9a34a741b00b78154dd2f))
> stays on-chain, unused.

## Wiring (post-deploy)

| Action | tx |
|---|---|
| `IdentityRegistry.set_escrow(Escrow)` | [`b5028d69…`](https://testnet.cspr.live/deploy/b5028d6954c47d3e2b041a47d86570f5d6d4a7f5da2fbfe8757daf68962b38cb) |
| `ReputationEngine.set_escrow(Escrow)` | [`3946d4ee…`](https://testnet.cspr.live/deploy/3946d4ee21dad5f8f592468e7661571bfba25637c96e86fa74ea416e6471a4ae) |
| `AgentTreasury.set_reputation_policy(ReputationEngine, 1)` | [`d565a0bc…`](https://testnet.cspr.live/deploy/d565a0bcbd9bbe0b77e222f9663c60623cf048d2583931de2eb3430791c8f1ad) |

The treasury enforces per-task (100 AGT) + daily (500 AGT) caps and a contract-level
reputation gate (whitelist OR `ReputationEngine.score(payee) >= 1`), and the owner
can halt every outflow with `pause()`.

## A customer's own vault, proven on-chain

One owner, one vault, one set of rules they wrote themselves — exercised end to end
on `casper-test` (2026-07-26). Same payment throughout; only the rule changes.

| What it proves | Transaction |
|---|---|
| Owner opens a vault (per job 100 AGT, per day 500 AGT, payee must have a track record) | [`51a90b14…`](https://testnet.cspr.live/transaction/51a90b147d93769a66c33ef833919d8f09a93c8d2d891e41e4fad843f6f27e1a) |
| Approve the vaults contract to move AGT | [`070544c7…`](https://testnet.cspr.live/transaction/070544c7ea882457ca795a79be138f5de9c7c8ac71fcd0c06a139caa1fc872da) |
| Deposit — the vault holds its own balance | [`c13ef2d0…`](https://testnet.cspr.live/transaction/c13ef2d02e8d3ee55a368922943ac254ab87a86906cc913349461b908d7d82f3) |
| Pay a vendor **with** a track record (#0, 508 bps) — settles | [`3aed451f…`](https://testnet.cspr.live/transaction/3aed451f55cb30b36ccd20cd80d8c9e696a1dd1dd79df23954698fdc58bed102) |
| Pay a vendor **without** one (#7, 0 bps) — refused, `PayeeNotAllowed` (User error 5) | [`5f3e803c…`](https://testnet.cspr.live/transaction/5f3e803c74668482c961ab0c029c4d3043610a3d712a6ee420f1bdc5543df34f) |
| Owner freezes the vault | [`d8c30a07…`](https://testnet.cspr.live/transaction/d8c30a07ba1a39ada3f3453b4054a5af0d24e2e2c2411006a750c4446ce62ec5) |
| The **previously accepted** payment now reverts, `Frozen` (User error 9) | [`c63383cc…`](https://testnet.cspr.live/transaction/c63383cc8246ca04e28be24b583331512f9f149346c434213d90f2a41cfdfc2f) |
| Owner releases it | [`893cd1f2…`](https://testnet.cspr.live/transaction/893cd1f21934e55c54d3d90d190669ceaa23bed8185781cf404dc6a64afb0831) |

Reproduce it: `npx vite-node sdk/scripts/vault-probe.mts`.

## The single-tenant envelope, proven on-chain

Same treasury, same payment — only the rule or the owner's decision changes.

| What it proves | Transaction |
|---|---|
| Unproven payee (#7, 0 bps) is refused **before** the balance is even checked | [`19ddb53b…`](https://testnet.cspr.live/transaction/19ddb53be543487fe8d6e25eb8278231e59ec90ee0cd00d550294cd77d8c4d13) |
| Proven payee (#0, 508 bps) clears the same gate and settles | [`64783cce…`](https://testnet.cspr.live/transaction/64783cce031a0516f0acf9658b4685fd3396c6fd66ba481413ebd88078562374) |
| Owner pulls the brake — `pause()` | [`d9e87d8a…`](https://testnet.cspr.live/transaction/d9e87d8a0bfb1dc4d5580b8e40917bfce82d2c95790531e38fe56afaad2003c7) |
| The **same** payment now reverts with `Paused` | [`c96cf67d…`](https://testnet.cspr.live/transaction/c96cf67dabaeb2eb3462278fc2ccc60cd6a14aa604be0dc2775bccf108ffdff8) |
| Owner releases it — `unpause()` | [`93bfa521…`](https://testnet.cspr.live/transaction/93bfa52145a64e865aee7d8856b95448e8d406a408ef01428928cbc46e36df7a) |
| Payment settles again, unchanged | [`e03063e3…`](https://testnet.cspr.live/transaction/e03063e3c7c74efc75ce5ac9a9bf4ed6fa42986183573d6214429d5159d39319) |

## How to deploy

```bash
# in WSL2 Ubuntu
cd contracts
export PATH=~/binaryen-latest/bin:$PATH      # binaryen v130 (apt v108 too old)
cargo odra build                              # -> wasm/*.wasm (CARGO_TARGET_DIR unset!)
# Odra 2.9.1 applies CSPR_CLOUD_AUTH_TOKEN itself; no local proxy needed (v2 deploy).
set -a; source .env; set +a                   # NODE -> public RPC, EVENTS -> cspr.cloud SSE
cargo run --release --bin contracts_cli -- deploy
```

## Tooling notes (see tasks/lessons.md)

The Casper ecosystem required five workarounds for an
Odra 2.8.1 → Casper 2.2.1 (Condor) testnet deploy:

1. **cspr.cloud auth** — Odra 2.8.1 reads `CSPR_CLOUD_AUTH_TOKEN` but never applies
   it. A small local proxy (`~/casper-proxy.py`) injects `Authorization: <token>`
   and routes RPC → `node.testnet.cspr.cloud`, SSE → `node-sse.testnet.cspr.cloud`.
2. **Contract address resolution** — Condor no longer registers the installed
   package under the deployer's named keys, so Odra's `get_contract_address` fails.
   Patched (`vendor/odra-casper-rpc-client`, `[patch.crates-io]`) to resolve the
   address from the deploy effects (the single `ContractPackage` write).
3. **Resilient event watcher** — the SSE matcher aborted on any event it couldn't
   parse; patched to skip un-parseable events and keep watching for the real
   `TransactionProcessed`.
4. **Pricing mode (2026-06-24 testnet upgrade)** — `casper-test` tightened its
   pricing rule: `PricingMode::PaymentLimited` with `gas_price_tolerance: 5` is now
   rejected as `"invalid pricing mode"`. Patched `transactions.rs` to
   `gas_price_tolerance: 1` (3 sites). `Fixed` is NOT accepted on `casper-test`
   (`pricing_handling = Classic`).
5. **Idempotent re-deploy (2026-06-24)** — `cli.rs` re-ran `set_escrow` on
   already-wired contracts → `EscrowAlreadySet` revert (`User error 6/3`). Switched
   to `try_set_escrow`, so re-running the deploy loads the existing contracts from
   the container, swallows already-set wirings, and installs only what's new.

The contract code itself is unmodified and fully tested (**62 green OdraVM tests**,
including the AgentTreasury and AgentVaults suites). **AgentVaults** — the 6th
contract and the one the dashboard is built on — was deployed 2026-07-26.

6. **No upgrade path in Odra** — changing a contract means a new install and a new
   package hash. Remove that contract's entry from
   `contracts/resources/casper-test-contracts.toml` first, or `load_or_deploy`
   silently reloads the old one. Append new storage fields **last**, so existing
   field indices (and any calibrated off-chain readers) stay valid.
