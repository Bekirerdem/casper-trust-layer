# Casper Agent Trust Layer — Build Plan

> Mimari KİLİTLİ (memory: `project-casper-buildathon`). TDD (OdraVM host env). Süre tahmini yok; her madde **risk** etiketli (düşük/orta/yüksek) + **doğrulama** kriterli.

---

## 🔥 FINAL SPRINT — Submit'e kadar (deadline 7 Temmuz 23:59 UTC)

> Kaynak: 2026-07-03 Fable 5 review — 131 BUIDL rakip analizi + repo audit.
> Sıra: iyileştirmeler → demo video → submit (Bekir kararı).
> Kontrat DEĞİŞMEZ (redeploy = tüm ağ sıfırlanır; slash-griefing bulgusu dokümante edilir, fix v2).

### Faz 1 — Credibility pass `[risk: düşük]` — ✅ TAMAM (commit aaa4845, push'lu)
- [x] README test sayısı 31→50 (3 yer) · doğrulandı: grep temiz
- [x] `web/lib/content.ts` kod örnekleri gerçek API imzasına · doğrulandı: sdk export'larıyla birebir, tsc temiz
- [x] `sdk/src/x402/index.ts` bayat "not exercised" yorumu → live-verified settle tx referansları
- [x] `sdk/README.md` `.git/sdd` referansı; `contracts/CHANGELOG.md` gerçek içerik; `web/README.md` gerçek açıklama
- [x] AI-brief artefakt yorumları temizlendi (treasury.rs, config.ts)

### Faz 2 — HIRE DÖNGÜSÜ (kullanıcı-odaklı yapı) — ✅ CANLI (commit 77c5a8b + ead9670, prod'da doğrulandı)
> Ziyaretçi: register → AGT faucet → agent kirala (approve + create_job imzaları) → provider (bizim agent) submit_work (server) → ziyaretçi approve → skor zincirde değişir, UI before/after gösterir.
- [x] 2.1 `/api/faucet` · doğrulandı: PROD'da taze hesaba on-chain AGT düştü (tx 6e3f6d3c…)
- [x] 2.2 `/api/hire/build` + `/api/tx/submit` (generic) · doğrulandı: canlı job #11 açıldı (tx 86019b2a…)
- [x] 2.3 `/api/hire/work` · doğrulandı: server-signed submit_work (tx 81c04dae…)
- [x] 2.4 approve_job · doğrulandı: settlement tx 04cea776…, provider #2 100→200 bps, jobs 1→2
- [x] 2.5 UI — HirePanel wizard (/app): agents/mine otomatik tespit + step tracker + before/after skor + explorer linkleri · build yeşil, prod'da canlı
- [x] +ekstra: `/api/tx/status` finality polling, `/api/agents/mine` cüzdan→agent eşleme, snapshot 8 settlement
- [x] Uçtan uca test: `sdk/scripts/test-hire-api.mts` (cüzdanı operator key oynayarak, canlı testnet)
- [ ] 2.7 🔴 BEKİR: Brave + Casper Wallet ile /app'te gerçek kullanıcı testi (agent #4 ile hire) — cüzdan-imza katmanının son doğrulaması
- NOT: refund/slash UI'a KONMADI (griefing yüzeyi açılmaz) · env fix: DEPLOYER_SECRET_PEM BOM temizliği (serverSigner)

### Faz 3 — MCP server — ✅ ÇALIŞIYOR (mcp/ dizini)
- [x] `casper-trust-mcp` — 3 tool: check_trust / get_reputation / get_agent · doğrulandı: JSON-RPC el sıkışması + canlı zincir okuma (check_trust(2)→200bps)
- [x] esbuild bundle (dist/index.cjs, tek dosya) — casper-trust ESM↔casper-js-sdk CJS interop sorunu bundle ile çözüldü
- [x] mcp/README.md: kurulum + Claude Code/Desktop/Cursor config + örnek diyalog; ana README 3 yerde güncellendi
- [ ] 30sn kayıt: Claude ödeme öncesi check_trust çağırıp karar veriyor (video aşamasında)
- [ ] (final round) npm publish: `npx casper-trust-mcp` (Bekir 2FA-bypass token)

### Faz 4 — Dokümanlar `[risk: düşük]` (Faz 2 ile paralel)
- [ ] `docs/reputation-formula.md` → İngilizce + §7 threat model'e ekle: slash-griefing (accepted risk, v2: accept_job), var-olmayan-provider fon kilidi, slashed-agent-skoru-treasury-gate tutarsızlığı
- [ ] README: "paid ≠ good work" rebuttal (bizim adjudication trust-minimized; LLM-jüri/trusted-verifier yazması DEĞİL — Vouch'un tersi)
- [ ] README: jüri-kriteri tablosu (Trust Rail/Cinder pattern'i) + "Verify It Yourself" explorer tablosu + Launch Plan bölümü (npm canlı = kanıt; roadmap: mainnet 3 blocker, MCP, treasury SDK)
- [ ] "2% burn" söylemi → "retained/locked" (escrow.rs:199 gerçeği)

### Faz 5 — Canlı aktivite + video + submit
- [ ] network-boost loop: submit gününe kadar taze settlement'lar (Cinder/Claros'a karşı "ölü ağ" görüntüsünü kır) · risk düşük
- [ ] Demo video: hire döngüsü (cüzdanla kirala→skor değişimi) + MCP kaydı + trust-gate REFUSED/APPROVED + cspr.live · risk orta
- [ ] DoraHacks BUIDL formu (Bekir hesabı) + YouTube upload (Bekir) — **7 Temmuz'u BEKLEME, video biter bitmez**

---

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
