# ReputationEngine Formülü — Grounded Tasarım

> Kaynak: 6-ajan paralel research + 12 adversarial doğrulama workflow'u (2026-06-15). Tüm aritmetik **unsigned integer / basis-point (0..10000)**, **O(1) incremental**, gas-bounded.

> **EN KRİTİK BULGU:** Naif `Δscore = amount × cp_weight × repeat_dampening` formülü tek başına **YETMEZ**. 12 adversarial doğrulamanın hepsi aynı artık saldırıya yakınsadı: **bought-edge / self-dealing reputation laundering** — saldırgan tek bir itibarlı/bonded `F` agent'ı edinir (veya kendi her iki tarafı sahiplenir), `F`'yi client olarak kullanıp hedefe sınırsız skor basar; her job taze pair olduğu için repeat-dampening tetiklenmez, cp_weight > 0 olduğu için sybil-sıfırlama da çalışmaz. Bunu kapatan **tek mekanizma per-edge lifetime contribution CAP + trust conservation**'dır (EigenTrust'ın max-flow + trust-mass-conservation özelliklerinin O(1) lokal projeksiyonu).

## 1. Formül

### 1.1 Saklanan durum (running aggregates, O(1))
Her **provider** (`agent_id: u32`) için:
- `score_bps: U256` — birikmiş itibar (bps, decimals=4)
- `jobs_completed: u64` — ERC-8004 `count`
- `total_volume: U256` — analitik
- `distinct_clients: u32` — breadth sinyali
- `granted_out_bps: U256` — bu agent client olarak ne kadar itibar konferans etti (trust-conservation)

Her **(provider, client_id) pair** için: `PairStat { jobs: u32, contributed_bps: U256 }` (mevcut `seen_client: bool` → bu struct'a yükselir), `pairs: Mapping<(u32,u32), PairStat>`.

### 1.2 Δscore (her settled job'da, tek geçiş)
```
v_bps         = isqrt(amount_scaled)                      // (a) konkav değer
d             = isqrt(client_earned_score_bps)
cp_weight_bps =                                           // (b) saturating counterparty weight
    if d < T_MIN        -> 0                              //   sybil/zero-rep -> 0
    else if d >= T_SAT  -> 10000                          //   established -> tam
    else  ((d - T_MIN) * 10000) / (T_SAT - T_MIN)
cp_weight_bps = max(cp_weight_bps, bond_floor_bps(client_id))   // cold-start (§2.3)
k             = pair.jobs
damp_bps      = max(DAMP_FLOOR_BPS, 10000 / (1 + k))      // (c) repeat dampening, floored
raw_delta_bps = v_bps * cp_weight_bps / 10000 * damp_bps / 10000   // (d) multiply-before-divide
edge_cap_bps  = EDGE_CAP_BASE_bps + bond_to_cap(client_bond)       // (e) PER-EDGE LIFETIME CAP
delta_bps     = min(raw_delta_bps, edge_cap_bps.saturating_sub(pair.contributed_bps))
grantor_budget = client_earned_score_bps * GRANT_K_bps / 10000    // (f) TRUST CONSERVATION
delta_bps      = min(delta_bps, grantor_budget.saturating_sub(client.granted_out_bps))
```
Birikim (O(1)): `provider.score_bps += delta; jobs_completed++; total_volume += amount; pair.jobs++; pair.contributed_bps += delta; client.granted_out_bps += delta; if pair.jobs==1 { distinct_clients++ }`.

## 2. Üç gerilim çözümü
- **SYBIL SWARM:** `cp_weight` client'ın **earned** skorundan okunur (distinct_clients/bond'dan DEĞİL). Zero-rep → cp_weight=0 → delta=0. Swarm maliyeti N×MIN_BOND lineer kapital; CoC > PfC parametrelenir.
- **COLLUSION/WASH:** (1) per-pair `damp=10000/(1+k)` hızla düşer, (2) per-edge `cap` ömür-boyu toplamı sınırlar (rotation/star'ı da kapatır), (3) escrow `burn fee` wash'ı gas-bedava olmaktan çıkarır. **Meşru tekrar korunur:** dampening per-pair, provider'ın skoru çok DISTINCT client'ın ilk job'larından gelir; breadth taşır.
- **COLD-START (paradoks: weight=0 deadlock):** `bond_floor_bps = if Active && bond>=MIN_BOND: min(BOND_FLOOR_CAP, bond*MAX_BP/(bond+K_BOND)) else 0`. `cp_weight = max(earned, bond_floor)`. Bond delik AÇMAZ çünkü: floor capped (< saturation, tam skor satın alınamaz), gated (Active+bonded), `granted_out` bütçesine girmez (sybil'e trust mint edilemez), canlı okunur (slash anında düşer). `max(floor,earned)` crossover = bedava fade-out, decay state'i gerekmez.

## 3. O(1) gas + imza değişikliği (ZORUNLU)
```rust
// ESKİ: client bare Address — okunacak rep yok, formül hesaplanamaz
fn record_settlement(&mut self, provider: u32, client: Address, amount: U256)
// YENİ: client kayıtlı agent_id — cp_weight + bond okunabilir
fn record_settlement(&mut self, provider: u32, client_id: u32, amount: U256)
```
Escrow `Job`'a `client_id` taşınır (client'lar da kayıtlı/bonded agent olmalı). Canonical 8004'ün iterate-all-history `get_summary` anti-pattern'i YAPILMAZ — running aggregates incremental. Maliyet/settlement: 1 cross-contract read (client bond+earned) + 1 pair read + sabit çarpma/bölme (isqrt ~8 iter) + ~5 yazma. **isqrt:** Babylonian/Newton, U256, bounded loop.

## 4. ERC-8004 get_summary eşlemesi
```rust
pub fn get_summary(&self, agent_id: u32) -> (u64, U256, u8) {
    let r = self.rep_of(agent_id);
    (r.jobs_completed, r.score_bps, 4u8)   // count, summary_value (bps), decimals=4
}
```
ERC-8004 `int128` (signed) yerine U256 unsigned. Hatalar negatif skorla değil **slashing** ile (bond floor düşür + status=Slashed). Tek yazma yolu objektif settlement = 8004'ün subjective-feedback deliğini kapatır.

## 5. Parametreler (governance-tunable)
| Param | Başlangıç | Rol |
|---|---|---|
| `T_MIN` | 10 | Sybil floor (altı cp_weight=0) |
| `T_SAT` | 50 | Honest saturation (üstü tam weight) |
| `DAMP_FLOOR_BPS` | 2000 (20%) | Repeat dampening tabanı |
| `EDGE_CAP_BASE_bps` | 5000 | Pair ömür-boyu katkı tavanı |
| `bond_to_cap` slope | +1 bps / CSPR>MIN | Edge cap ↔ client bond |
| `GRANT_K_bps` | 5000 (50%) | Trust-conservation oranı |
| `MAX_BP` (bond floor) | 5000 (<10000!) | Bond asla tam skor satın alamaz |
| `BOND_FLOOR_CAP` | 1000 (10%) | Newcomer floor tavanı |
| `K_BOND` | ≈4× tipik job değeri | Bond floor yarı-doygunluk |
| `FEE_BPS` (escrow burn) | 200 (2%) | Wash maliyeti |
| `MIN_BOND` | 10 CSPR | Per-identity sybil maliyeti |

**En load-bearing:** `EDGE_CAP` + `GRANT_K` — sim/test ile kalibre (literatürden değil). Gevşek→bought-edge geri döner, sıkı→meşru high-volume boğulur.

## 6. Test planı (OdraVM)
- **T1 sybil-swarm:** 50 zero-rep bonded agent P'yi öder → `P.score_bps == 0`
- **T2 collusion-pair:** A↔B 100 trade → delta monoton azalır, `pair.contributed <= edge_cap`
- **T3 star/bought-edge:** F → 20 sybil provider → `sum(Ti.score) <= F.earned * GRANT_K/10000` (naif formülün düştüğü saldırı)
- **T4 legit-repeat:** itibarlı C, iyi P'yi 50× + P'nin 30 distinct client'ı → P pozitif kalır, breadth taşır
- **T5 cold-start:** yeni A,B (bonded, earned=0), A→B → `B.score_bps > 0` ama capped
- **T6 slash:** F bought-edge başlatır, dispute slash → `cp_weight==0`, yeni delta üretemez
- **T7 get_summary:** `(jobs_completed, score_bps, 4)`, O(1)
- **T8 burn-fee:** wash ring net `N*fee*V` kaybeder

## 7. v1'de kabul edilen riskler / ertelemeler
1. **Single-hop only** (transitive trust yok) — gerçek multi-hop EigenTrust off-chain+zk gerektirir, O(1)/unsigned'la uyumsuz. Bilinçli takas.
2. **EDGE_CAP/GRANT_K kalibrasyonu** sim gerektirir (mainnet öncesi parametre sweep şart). Risk: orta.
3. **Slashing oracle problemi** — collusion'ı on-chain kanıtlamak meşru high-freq'ten ayırt edilemez; slash sadece escrow dispute için, collusion için DEĞİL. Birincil savunma cap+conservation+fee.
4. **Build-then-betray / exit scam** — tek büyük job payoff'u birikmiş rep+bond'u aşabilir. v2 hardening (kapsam dışı): job-proportional dynamic bond, milestone escrow, concurrency cap, time-locked rep maturation.
5. **Decay yok** (v1) — `granted_out` monoton artar, lazy half-life right-shift (`score >> Δt/H`) v2 hardening.
6. **Client'lar kayıtlı olmalı** (`client_id: u32`) — sybil maliyeti ama UX sürtünmesi (client'lar da bond yatırır).
7. **isqrt gas** ölçülmedi — düşük risk, deploy öncesi OdraVM bench.

## Etkilenen dosyalar
- `reputation.rs` — formül + state (score_bps/granted_out_bps/PairStat) + isqrt + cross-contract bond read + get_summary; imza `client: Address`→`client_id: u32`
- `escrow.rs` — `Job.client_id`, `settle()` burn FEE_BPS, record_settlement çağrısı client_id taşır
- `identity.rs` — `AgentStatus::Slashed` escrow dispute path'ten set + bond seizure; `Agent.bond` cross-contract canlı okunur
