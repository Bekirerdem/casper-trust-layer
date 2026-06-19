# Casper Agent Trust Layer — Build Plan

> Mimari KİLİTLİ (memory: `project-casper-buildathon`). TDD (OdraVM host env). Süre tahmini yok; her madde **risk** etiketli (düşük/orta/yüksek) + **doğrulama** kriterli.

## Milestone 0 — Setup
- [x] Toolchain audit (Rust 1.96, Node 24, wasm target eklendi)
- [x] Odra v2.8.1 API grounding (subagent)
- [x] cargo-odra 0.1.7 kuruldu
- [x] `cargo odra new` → `contracts/` scaffold
- [ ] **Doğrula:** `cargo odra test` (flipper, OdraVM) yeşil → toolchain uçtan uca çalışıyor *(in progress, nightly indiriliyor)*
- [ ] git repo + skeleton commit
- [ ] (ertelendi) wabt + binaryen → `cargo odra build` / deploy için
- [ ] (ertelendi) testnet key + faucet + x402 sponsored access talebi (support@cspr.cloud)

## Milestone 1 — IdentityRegistry  `[risk: orta]` — ✅ TAMAM (canonical ERC-8004 hizalı, 14/14 yeşil)
Custom Odra modülü (Erc721Token owner-gated mint + U256 id zorladığı için wrap edilmedi). **u32 sequential id**, transferable.
`Agent { owner, wallet, agent_uri, bond: U512, status: Active|Slashed|Withdrawn }`
- [x] `register(agent_uri)` [payable+bond], sequential u32 id, MIN_BOND=10 CSPR, yetersiz-bond reddi
- [x] read surface (8004): `agent_exists`/`total_agents`/`find_owner`/`agent_uri`/`get_agent_wallet`/`get_agent`/`is_authorized_or_owner`
- [x] owner-gated mutations: `set_agent_uri`/`set_agent_wallet`/`withdraw`/`transfer` (wallet-reset, canonical davranış)
- [x] events: `Registered`/`AgentUriUpdated`/`AgentWalletSet`/`Transferred` (8004 indexer uyumu)
- [ ] (ERTELENDİ → polish/v2) on-chain key-value metadata (`set_metadata`/`get_metadata`), ERC-721 approvals (`is_authorized_or_owner` şu an owner-only)
- [ ] (ERTELENDİ → entegrasyon) `status`→Slashed + bond slash/refund: escrow/reputation çağırınca; bond refund withdraw'da

## Milestone 2 — Escrow  `[risk: orta-yüksek]` — ✅ TAMAM (10 test, toplam 24/24 yeşil)
PRISM pattern'leri: checks-effects-interactions (spend transfer'den önce), per-job attribution. CEP-18 ödeme.
`Job { client, provider, amount: U256, result_hash, deadline, state: Funded→Submitted→Released/Refunded }`
- [x] `create_job` CEP-18 fonu kilitler (`transfer_from`), state=Funded, `JobCreated` event
- [x] `submit_work` sadece provider, Funded→Submitted, deadline öncesi (sonra `DeadlinePassed`)
- [x] `approve` sadece client, fon provider'a + **`JobReleased` event (reputation sinyali)**
- [x] `refund` deadline sonrası client'a iade (iş gelmezse), `JobRefunded`
- [x] `claim` deadline sonrası provider'a (client onaylamazsa — provider koruması)
- [x] state machine + yetki invariant'ları (geçersiz geçiş/caller revert)
- [ ] (ERTELENDİ → entegrasyon) provider bond slash refund'da (IdentityRegistry cross-call)

## Milestone 3 — ReputationEngine  `[risk: yüksek]` — v1 ÇEKİRDEK ✅ (5 test, toplam 29/29 yeşil)
**Ürünün beyni.** İtibar SADECE escrow settlement'tan (objektif, ödeme-destekli, uydurulamaz). agent_id-keyed (canonical 8004 gibi → itibar transferable kimliğe bağlı).
`Reputation { jobs_completed, total_volume, distinct_clients }`
- [x] v1 `record_settlement(provider, client, amount)` escrow-only; jobs/volume/distinct_clients sayar
- [x] v1 `get_reputation`, `score` (placeholder = job count, cap 100), `SettlementRecorded` event
- [x] **ENTEGRASYON ✅:** Escrow `provider`→agent_id, IdentityRegistry'den wallet çözüp ödeme, settle'da `ReputationEngine.record_settlement` cross-call. **Full-loop testi GEÇTİ** (register→job→submit→approve→provider ödendi + itibar güncellendi). 3 kontrat bağlı, tüm cross-call'lar tek tx'te.
- [ ] (ERTELENDİ) refund'da IdentityRegistry bond slash (escrow-auth + circular dep → ayrı ele alınacak)
- [x] **FORMÜL RESEARCH ✅ (workflow, 6 ajan + 12 adversarial):** Naif 3-çarpan formül DÜŞTÜ (bought-edge laundering). Çözüm: value(isqrt) × cp_weight(saturating) × damp(floored) + **per-edge cap + trust conservation** + bond-floor cold-start. Tam tasarım: `docs/reputation-formula.md`

### M3 Formül Implementasyonu (çekirdek) — ✅ TAMAM (31/31 yeşil)
- [x] **Stage 1 IdentityRegistry:** `slash` (escrow-auth, bond seize + Slashed), `set_escrow`, `withdraw` bond refund
- [x] **Stage 2 ReputationEngine formül:** `record_settlement(provider, client_id: u32, amount)`; `score_bps`/`granted_out_bps`/`PairStat` state; **isqrt** (Babylonian U256); IdentityRegistry cross-call (canlı bond/status); formül (value isqrt × cp_weight saturating × damp floored + **per-edge cap + trust conservation** + bond-floor cold-start); `get_summary` facade
- [x] **Stage 3 Escrow:** `Job.client_id` (agent-to-agent, caller=client wallet, self-hire revert), `settle()` **burn FEE_BPS** (2%), record_settlement client_id taşır, refund'da provider **slash**
- [x] **Adversarial testler:** sybil/unregistered→0 ✅ · slashed→0 ✅ · collusion-pair diminishing+edge-cap ✅ · **T3 bought-edge/trust-conservation ✅** (naif'in düştüğü) · cold-start bootstrap ✅ · burn-fee+slash ✅ · get_summary ✅
- [ ] (v2 hardening, kapsam dışı) dynamic bond, lazy decay, sim-kalibrasyon (EDGE_CAP/GRANT_K) — `docs/reputation-formula.md` §7

## Milestone 4 — Deploy
- [x] 3 kontrat cross-call wiring (M3 entegrasyon)
- [x] **`cargo odra build` → 3 optimize wasm** (IdentityRegistry 280K / Escrow 286K / ReputationEngine 285K, signext+memcopy lowered, Casper VM uyumlu). binaryen v130 GitHub'dan (apt v108 eski).
- [x] Deploy keypair (ed25519) `~/casper-keys/secret_key.pem`, pubkey `01f7a9a650276f0bbbb0dd59a2048cae7ff7976b6f4dad0a337c66d1d09e6aa5ab`
- [x] Deploy script (`bin/cli.rs`, odra-cli) + `.env.example` (3 kontrat + Cep18 + wiring)
- [x] cli bin compile (livenet deps)
- [x] **FAUCET** — hesap fonlu (Bekir, 5000 CSPR), secret_key (secp256k1) deploy konumunda
- [x] **RPC** — cspr.cloud + local auth-proxy (`~/casper-proxy.py`; Odra token'ı uygulamıyor + SSE ayrı subdomain)
- [x] **Odra patch** (vendor + [patch.crates-io]) — Condor'da named-keys boş → effects'ten ContractPackage resolution + resilient SSE matcher
- [x] ✅ **DEPLOY + WIRE TAMAM** — 4 kontrat + 2 set_escrow, 6 tx hepsi başarılı testnet'te. Adresler + cspr.live linkleri: `DEPLOYMENT.md`

## Milestone 5 — Off-chain  (DEVAM EDİYOR)
- [x] Functional doğrulama — `hero-loop.mts` canlı (register→job→submit→approve→settle, success #4 scoreBps 0→100)
- [x] casper-trust SDK (checkTrust/getReputation/getAgent/pay/register) — 66 test, npm'de `casper-trust@0.1.0` CANLI
- [ ] **x402 CANLI HANDSHAKE (WCSPR yolu)** ← ŞİMDİ
  - [ ] Faz 0: client'a WCSPR sağla (CSPR→WCSPR wrap) · doğrula: balance_of>0 · risk düşük
  - [ ] Faz 1: imzalı payload → facilitator `/verify` · doğrula: valid:true (secp256k1+domain+token uyumu) · risk orta
  - [ ] Faz 2: Express paywalled endpoint + `pay()` → `/settle` · doğrula: on-chain WCSPR transfer cspr.live · risk orta
  - [ ] Faz 3: SDK'ya entegre + demo script (hero-loop tarzı) · risk düşük
  - NOT: standart AGT CEP-18 settle EDİLEMEZ (facilitator `transfer_with_authorization`/CEP-3009 ister). WCSPR (`3d80df21...`) facilitator'da destekli. Auth: `Authorization: <token>` düz (Bearer YOK). EIP-712 `version="1"`, domain custom-field `chain_name`+`contract_package_hash`.
- [ ] Next.js dashboard (UI = Bekir + Gemini; SDK read katmanı = Claude)
- [ ] Demo video (Remotion, EN SON) + DoraHacks submission

## Milestone 4 — Integration + Deploy
- [ ] 3 kontrat bağlanır (escrow→reputation hook, escrow→identity bond/slash)
- [ ] **Adversarial simülasyon harness** (honest/fraud/sybil/collusion senaryoları)
- [ ] wabt + binaryen kur → `cargo odra build` wasm üret
- [ ] testnet deploy + tx-kanıt disiplini (cspr.live, Chainleash'in 9-proof pattern'i)

## Milestone 5 — Off-chain (sonra)
- [ ] x402 TS client (SDK yok → yaz; ekosistem katkısı)
- [ ] agent runtime (LLM + MCP + x402)
- [ ] CSPR.cloud SSE reputation indexer
- [ ] Next.js + CSPR.design frontend (UI = Bekir + Gemini)

## Açık kararlar
- Repo brand ismi (working: `casper-trust-layer`)
- Bond mekanizması: native CSPR vs CEP-18 (M1'de netleşir)
- Dispute karmaşıklığı: deadline+hash vs optimistic challenge (research item)

## Review
*(her milestone sonunda doldurulacak)*
