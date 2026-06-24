# Casper Trust Console + Bounded Treasury — Tasarım Spec'i

**Tarih:** 2026-06-23
**Durum:** Kapsam onaylandı (Bekir). **Kod YARIN başlar** — bu gece sadece spec.
**Önceki:** Landing v2 editorial bitti (8 section). Bu faz onun ÜSTÜNE kullanıcı-odaklı interaktif ürün ekler.

---

## Neden bu faz (bağlam)

- **Bekir geri bildirimi:** Landing "sunum gibi" oldu — bir şey *anlatıyor*, kullanıcıya *yaptırmıyor*. "Kim nasıl kullanacak?" baştan sorulmadı.
- **Rakip analizi (DoraHacks 62 submission):** Kazanan pattern = **canlı senaryo göster** (Vouch kiralama+slash, cred402 credit-line konsolu, verity reputation-check). Biz anlatıyoruz, onlar gösteriyor. Açığımız: canlı interaktif ürün + demo video yok.
- **PRISM adoption:** Bounded treasury + kontrat-seviyesi reputation-gating pattern'i = canlı senaryonun kalbi.
- **Hedef:** "Casper Trust Console" — landing'in anlattığını **kullanılabilir** hale getiren interaktif ürün.

## Kapsam dışı (net)

- ❌ ZK confidential proof (Casper VM'de BN254 pairing precompile yok — blocker).
- ❌ Midnight entegrasyonu — README/pitch'te "planned extension" vizyonu olarak GEÇ, implement etme. Post-hackathon ayrı track.
- ❌ Cross-chain bridge.
- ❌ Credit/lending layer (cred402 alanı, scope creep).

---

## Bileşen 1 — Bounded Treasury kontratı (Odra, 5. kontrat)

PRISM `treasury` kontratının Casper/Odra portu. İşletme/kullanıcı bir AI agent'a **cap'li harcama zarfı** verir; kontrat limitleri zorlar.

**`AgentTreasury` state (taslak):**
- `admin` (owner), `agent` (delege AI cüzdanı), `token` (Cep18), `daily_limit`, `per_task_limit`
- `reputation_registry` (ReputationEngine pkg hash), `min_reputation` (eşik)
- `DaySpent: Mapping<u64, U256>` (gün = `block_time / 86400`, UTC reset)
- `TaskSpent: Mapping<u64, U256>` (per-task attribution)
- (opsiyonel) `Reservation: Mapping<u64, {to, amount, deadline, state}>` (locked-funds escrow)

**Entry point'ler:**
- `pay(task_id, to, amount)` — agent çağırır. Kontroller: (1) `to` whitelist'te VEYA `ReputationEngine::score(to) >= min_reputation` (cross-call); (2) `TaskSpent[task_id] + amount <= per_task_limit`; (3) `DaySpent[today] + amount <= daily_limit`. Checks-effects-interactions (ledger önce, transfer sonra).
- `set_reputation_policy(registry, min_reputation)` — admin opt-in gate.
- (opsiyonel) `create_reservation / release_reservation / refund_reservation` — outcome-bound, fon treasury'de kilitli.

**Casper feasibility:** Mekanik port — Stellar'a özgü hiçbir şey yok. `get_block_time()`, `Mapping`, `Cep18ContractRef`, mevcut `ReputationEngine` cross-call. Efor: **düşük**. Build WSL2 Odra (Casper native Windows'ta derlenmiyor), sonra testnet deploy + verify.

**Değer:** "Treasury agent registry'den trust-gated servis agent kiralar, cap'li harcama" = playground'un canlı senaryosu. **reputation-gating artık protokol-seviyesi** (SDK-bypass açığı kapanır).

## Bileşen 2 — Casper Trust Console (frontend)

Mevcut `web/` Next.js app'ine eklenen interaktif ürün. DNA v2 editorial dili (off-white/kırmızı/altın/Zodiak) korunur ama "console" daha yoğun (DENSITY yukarı, dashboard ritmi).

**A. Explorer** (cüzdansız read):
- Testnet'teki agent'ları listele: agentId, scoreBps, bond, status, jobsCompleted, son escrow geçmişi.
- `casper-trust` SDK `getAgent`/`getReputation` ile canlı (veya snapshot). cred402'nin "canlı konsol"unun bizdeki karşılığı.

**B. Playground** (canlı trust-gating denemesi — ÇEKİRDEK demo):
- İki senaryo: düşük-trust agent ödeme ister → SDK `pay({minScore})` **REJECTED** (ekranda, zincire gitmedi). 208-skor agent → **APPROVED** + on-chain settle tx hash (cspr.live link).
- Kullanıcı eşiği (`minScore`) kaydırıp canlı sonucu görür. "Kim nasıl kullanacak"ın canlı cevabı.

**C. Treasury "hire an agent" akışı:**
- Treasury'ye bütçe (CSPR/token) yatır → AI agent iş dağıtır → trust-gate (düşük-trust reddedilir) → settle → skor güncellenir.
- Cüzdan gerekirse: CSPR.click (ekosistem standardı). Karar açık (aşağıda): tam cüzdan akışı mı, "demo mode" (önceden funded agent ile imzalı senaryo) mı.

## Bileşen 3 — Demo video (60-90 sn)

Playground/treasury senaryosunun ekran kaydı + dar anlatı: "Agent A skor 50, eşik 150 → REJECTED. Agent C skor 208 → APPROVED, settle on-chain, tx [X]." Jüri okumak yerine izleyip anlıyor. **En son** (ürün bitince). Remotion vs ekran kaydı = açık karar.

## Bileşen 4 — Landing düzeltmeleri

- GitHub/npm linkleri gerçek: `github.com/Bekirerdem/casper-trust-layer` + `npmjs.com/package/casper-trust` (placeholder'lar düzeltilecek).
- README'ye: "confidential threshold proof — Midnight ile planlanan uzantı" vizyon paragrafı (ZK açısını gösterir, implement yok).

---

## Mimari katmanlar

- **On-chain:** mevcut 4 kontrat (Identity/Escrow/Reputation/Cep18) + **AgentTreasury** (yeni). WSL2 Odra build → testnet deploy + verify.
- **SDK:** `casper-trust` (read + `pay`) + treasury read/write sarmalayıcı (gerekirse).
- **Frontend:** `web/` Next.js + console route'ları (`/console` veya ayrı sayfalar). Read cüzdansız; playground/treasury yazma için CSPR.click (karara bağlı).

## Build sırası (high-level — detaylı task plan yarın writing-plans ile)

1. **Bounded Treasury kontratı** (Odra, WSL build + test) → testnet deploy + verify + DEPLOYMENT.md güncelle.
2. **SDK/read katmanı** — treasury + agent-list read (console için).
3. **Console frontend** — Explorer → Playground → Treasury akışı (DNA v2 editorial, console yoğunluğu).
4. **Landing düzeltmeleri** — linkler + Midnight vizyon paragrafı.
5. **Demo video** (en son).
6. **DoraHacks submit** + CSPR.fans.

## Açık kararlar (yarın netleşecek)

1. Console mevcut `web/` içinde `/console` route mu, yoksa ayrı bir bölüm mü?
2. Playground/treasury: tam **CSPR.click cüzdan** akışı mı, yoksa **demo-mode** (önceden funded agent'larla, kullanıcı cüzdan bağlamadan senaryoyu tetikler) mi? (Demo-mode jüri için daha sorunsuz olabilir.)
3. Treasury locked-funds escrow (reservation) dahil mi, yoksa sadece `pay` cap'leri mi (MVP)?
4. Demo video: Remotion (kod-tabanlı) mu, ekran kaydı mı?
5. Agent verisi: canlı RPC mi, snapshot mı (explorer için — demo güvenilirliği).
