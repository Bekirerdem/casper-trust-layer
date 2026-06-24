# Casper Trust Layer — avax-uyarlı Layout DNA Spec'i

**Tarih:** 2026-06-24
**Durum:** Layout map onaylandı (Bekir, "onaylıyorum başla"). Bu spec writing-plans + görsel implementasyonun tek referansı.
**Önceki:** Landing v2 editorial (off-white/Zodiak) BİTTİ ama "sunum gibi" + tek-kolon-statik kaldı. Bu spec onu **avax.network/business** layout DNA'sına taşır.
**Kaynak DNA:** avax.network/business (Gemini ile section-section layout analizi yapıldı).

---

## 0. Niyet (tek cümle)

avax'ın "kurumsal-teknik" layout repertuvarını (sticky-scroll · bento · asimetrik split · full-bleed marquee) bizim mevcut 8 section'lık landing'e + yeni Console'a uyarlamak; geniş dikey nefesi korumak ama her section'ın *iç kompozisyonunu* tek-kolon-statik'ten zenginleştirmek. Görsel dil de avax'a döner: dark-dominant + disiplinli kırmızı accent + grotesk display (Zodiak/off-white editorial'in yerini alır).

## 1. Kapsam

**Dahil:** landing'in 8 section'ının layout + görsel DNA dönüşümü · Console layout iskeleti (Explorer/Playground/Treasury) · korunan motion/veri altyapısı.
**Sıra:** **landing ÖNCE** (tam bitir), **Console ikinci faz** (kendi planı; bu spec yalnız iskeletini sabitler).
**Kapsam dışı:** kontrat işi (ayrı SDD kolu) · birebir Aeonik font (lisanslı — alternatif aşağıda) · avax'ın spesifik içeriği/copy'si (bizimki Casper trust içeriği kalır).

## 2. Layout sistemi (avax'tan damıtılmış — global)

| Parametre | Mevcut (v2) | Yeni (avax DNA) |
|---|---|---|
| Grid | yok (tek kolon) | **12-kol** esnek grid, gutter `24px` |
| Container | `max-w-[1200px]` | `max-w-[1280px]` (içerik), bazı section'lar **full-bleed** |
| Dikey ritim | `clamp(7rem,15vw,15rem)` her section | `clamp(6rem,10vw,10rem)` (~96–160px) standart; logo-wall dar (`py-12`) |
| İç ritim | — | başlık↔içerik `48–64px`, eleman arası `24px` |
| Hizalama | hep ortalı/simetrik | **section'a göre değişir** (asimetrik 5/7, bento, split) |
| Mobil (<768px) | dikey stack | 12-kol → 1-kol stack, padding `64–80px`, asimetrik bloklar "önce başlık/metin sonra medya" |

**`Section` primitive genişler:** mevcut `max-w-[1200px] + clamp padding` korunur ama opsiyonel `grid` (12-kol), `bleed` (full-bleed), ve `tone` (dark/light section ritmi) prop'ları eklenir. Yeni layout primitive'leri: `Grid` (12-kol wrapper), `SplitSection` (asimetrik n/m), `BentoGrid` (kart ızgarası). Mevcut `Divider` korunur ama dark temaya uyarlanır.

## 3. Landing — section-by-section layout map

Sayfa sırası DEĞİŞMEZ (`Hero → Problem → HowItWorks → TrustGating → LiveProof → Developer → FinalCta → Footer`). Her section'ın **iç düzeni** değişir:

### 3.1 Hero — *1-col center*
- `max-w-3xl` (~768px) ortalı metin bloğu, dev grotesk başlık (negatif harf aralığı), alt başlık, yan yana çift CTA: **"View Protocol"** + **"Launch Console"**.
- Üstte nav'ı kurtaran büyük top-padding (~`pt-40`/160px), altta `pb-24`.
- Mevcut **Centerpiece** (gerçek tx data-viz) korunur ama Hero altına gömülü, sayısal/mono, statik-ağırlık (avax'ın hareketsiz ciddiyeti).
- İmza: scroll-tetikli text-reveal (mevcut `Reveal` altyapısı).

### 3.2 Problem — *full-bleed marquee + framing*
- Full-bleed (ekran ucu-ucu) sonsuz kayan yatay bant: "trust-gating for agents:" + ekosistem/kavram logoları veya rozetleri (`py-12` dar).
- Hemen altında tek güçlü problem cümlesi (asimetrik, sol-ağırlık).

### 3.3 HowItWorks — *Sticky-scroll 01–04* ⭐ (en büyük yapısal hamle)
- 12-kol: **sol 5-kol `position: sticky`** numaralı adım listesi (01 Identity → 02 Settle → 03 Reputation → 04 Trust-gate), aktif adım highlight.
- **sağ 7-kol** scroll-tetikli görsel: gerçek tx akışı (agent → x402 → settle → reputation), her adımda crossfade/slide.
- Toplam yükseklik ~`300–400vh` (adım başına ~1 viewport). Mobil: sticky kapanır, dikey stack (her adım kendi görseliyle).
- Mevcut `StickyStack` (GSAP, izole) bu section'ın motoru olur.

### 3.4 TrustGating — *asimetrik feature-split*
- 12-kol split: sol metin (gate mantığı), sağ **canlı kart çifti** — REJECTED (düşük skor) / APPROVED (208 skor) + `minScore` slider (kaydır → sonuç değişir).
- Bu section playground'un landing'deki teaser'ı; gerçek on-chain tx hash linki (cspr.live).

### 3.5 LiveProof — *case-study grid (3-kol)*
- Başlık asimetrik split (sol 6-kol başlık / sağ paragraf). Altında `grid-cols-3` kart: gerçek settle tx'leri (hash, tutar, cspr.live link), keskin bento kartlar.
- Viewport-tetikli stagger fade-up. Mobil: `scroll-snap-type: x` yatay carousel.

### 3.6 Developer — *bento feature*
- Asimetrik: sol açıklama (cüzdansız oku, npm `casper-trust`), sağ büyük **CodeBlock** (SDK örneği). Keskin bordür, flat, mono.
- Mevcut `CodeBlock` primitive korunur (dark'a uyarlanır).

### 3.7 FinalCta — *asimetrik split + sticky başlık*
- 12-kol: sol 4-kol `sticky` başlık ("Start building trusted agents"), arada offset, sağ 7-kol CTA blokları (GitHub / npm / Launch Console / docs linkleri). Maksimum kapanış padding'i (`py-40`).

### 3.8 Footer — *5-kol grid*
- Üst: `grid-cols-5` (1 marka + 4 link kolonu). Alt: `flex justify-between` (legal sol / social sağ). Kompakt `pt-16 pb-8`. **Gerçek linkler** (github.com/Bekirerdem/casper-trust-layer, npmjs.com/package/casper-trust) — placeholder yok.

## 4. Console — *ürün yüzü* (ikinci faz, iskelet)

avax'ın "product" katmanı landing'den farklı: **full-bleed app layout**, ama aynı keskin/flat disiplin.
- **Sol `w-64` sticky sidebar** (nav: Explorer / Playground / Treasury) + **üst topnav** (arama: agent-id/tx-hash, sağda cüzdan).
- İçerik `p-8` (landing'in 160px nefesinden daraltılmış), 12-kol.
- **Explorer:** üst satır `grid-cols-4` bento metrik kartları (Total Agents / Total Settled / Avg Score / Slashed) + masif veri tablosu (Agent ID `2-kol` · Son tx özeti `5-kol` · Skor `2-kol` sağ-hizalı · Durum `3-kol`), `overflow-x-auto`.
- **Playground:** tablo satırına tıkla → sağdan kayan `w-[40vw]` **drawer** (off-canvas), arkada tablo karartılı; drawer'da canlı trust-gate denemesi (minScore → REJECTED/APPROVED + on-chain tx).
- **Treasury:** "hire an agent" akışı (cap'li harcama, AgentTreasury kontratına bağlı — kontrat kolu canlıya çıkınca).

> Console verisi `casper-trust` SDK read katmanı + snapshot (demo güvenilirliği). Cüzdan: CSPR.click (Bekir'in kararı — landing CTA'ları console'a köprü).

## 5. Görsel DNA katmanı (renk · tipografi · hareket)

Layout'un üzerine avax görsel dili. **Mevcut off-white/Zodiak editorial'in yerini alır.**

### 5.1 Renk (dark-dominant + kırmızı accent)
- Arka plan: mürekkep-siyah `#000` / antrasit yüzey `#0A0A0A`–`#111`; **ritim için beyaz section'lar** (avax gibi koyu↔açık dönüşümü).
- Metin: koyuda `#FFFFFF`, açıkta `#000`; ikincil nötr gri `~#A3A3A3`.
- **Accent: tek kırmızı** (avax `#E84142` referans; Casper kimliği için ton ince ayarı Bekir+Gemini) — yalnız hover / aktif çizgi / vurgu kelime / canlı durum. Asla geniş alan.
- (Mevcut `--accent-gold` editorial'e aitti; dark DNA'da kaldırılır veya çok kısıtlı kalır — karar Bekir+Gemini.)

### 5.2 Tipografi
- **Display: grotesk** (geometrik, Aeonik karakteri). **Aeonik lisanslı → kullanılamaz.** Öneri (araştırma-bazlı): **Geist** (Vercel, ücretsiz, `next/font` built-in, Aeonik'e en yakın geometrik grotesk). Alternatifler: General Sans (Fontshare) / Space Grotesk. **Karar: Geist** (yoksa Bekir+Gemini değiştirir).
- Body: Geist (veya Inter). Mono: JetBrains Mono (adres/tx/skor) — korunur.
- Ölçek: devasa display `clamp(48→80px)` ↔ body `16–18px`, **sert kontrast**, ara boylar atlanır. Display'de negatif harf aralığı `-0.02…-0.04em`.

### 5.3 Hareket (avax disiplini)
- Fonksiyonel, WebGL şovu yok. Mevcut altyapı korunur/genişler: `Reveal` (whileInView), `StickyStack` (GSAP, HowItWorks motoru), reduced-motion reaktif.
- Eklenenler: full-bleed **marquee** (Problem), `cubic-bezier` geçişler (`duration-300 ease-in-out-cubic`), viewport-tetikli stagger (LiveProof), (varsa) `IntersectionObserver` video. Sadece `transform`+`opacity`, GSAP↔framer izole, `ctx.revert` cleanup.
- UI: flat, ince kenarlık (`border-white/10`), gölge yok; keskin/az radius (`0–8px`); outline butonlar (hover'da dolar); terzi-işi mikro SVG ikonlar (1–1.5px stroke).

## 6. Korunan altyapı (yeniden yazılmaz)

- **Veri:** `casper-trust` SDK read + `snapshot.json` (gerçek agent#0 = 208 scoreBps, 4 jobs, 5 settlement). Centerpiece/LiveProof/TrustGating verisi buradan.
- **Motion:** `components/motion/` (`Reveal`, `StickyStack`, `MotionConfig`) — dark temaya uyarlanır, mantık korunur.
- **Primitive'ler:** `Section` (genişler), `CodeBlock`/`Stat`/`Badge` (dark'a re-skin), `Divider` (re-skin). `AccentWord`/`SectionLabel` editorial'e özgüydü — dark DNA'ya uyarlanır veya sadeleşir.
- **Sayfa iskeleti:** `app/page.tsx` section sırası aynı; her section component'i içten yeniden kompoze edilir.

## 7. Build sırası (writing-plans bunu detaylandıracak)

1. **Tema katmanı** — `globals.css` dark token'lar (siyah/antrasit/beyaz-ritim + kırmızı accent) + Geist `next/font` wiring (Zodiak/Switzer/off-white kaldır).
2. **Layout primitive'leri** — `Section` genişletme + `Grid`/`SplitSection`/`BentoGrid`.
3. **Section dönüşümleri** (sırayla, her biri görsel checkpoint): Hero → Problem(marquee) → **HowItWorks(sticky-scroll)** → TrustGating(split) → LiveProof(grid) → Developer(bento) → FinalCta(split) → Footer(5-kol).
4. **Responsive + perf + reduced-motion** geçişi.
5. **Console** (ayrı faz/plan).

## 8. Açık kararlar (writing-plans / implementasyonda netleşir)

1. Accent kırmızı tonu: avax `#E84142` mı, Casper'a özel bir ton mu? (Bekir+Gemini görsel checkpoint'te.)
2. `--accent-gold` tamamen kalkıyor mu, yoksa çok kısıtlı bir ikincil sinyal mi? (Bekir+Gemini.)
3. Beyaz "ritim section"ları hangileri? (öneri: LiveProof veya Developer bir beyaz nefes section'ı olabilir — görsel checkpoint.)
4. Display font kesin Geist mi? (öneri Geist; Bekir+Gemini ilk Hero checkpoint'inde teyit.)

> Bu 4 karar layout'u bloklamaz — implementasyon Geist + dark + kırmızı accent + avax layout pattern'leriyle başlar, görsel checkpoint'lerde Bekir+Gemini ince ayar yapar. ([[feedback_frontend_design_gemini]] [[feedback_first_design_quality]])
