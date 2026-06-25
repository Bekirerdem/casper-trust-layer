# Casper Trust Layer — Landing Page Tasarım DNA'sı

**Tarih:** 2026-06-21 (v1 ink/green) → **2026-06-22 REVİZE v2 (editorial luxury, light)**
**Durum:** v2 onaylandı (Bekir) — uygulama: Task 2 (tema/font) + Task 5 (Hero) revize + Task 6-9.
**Kapsam:** Landing page tasarım DNA'sı. Dashboard ayrı faz.

> **v2 NOTU:** Bekir lüks renk paleti (kırmızı/altın/krem) seçti + **açık/beyaz-tonlu zemin** + 2026 trend istedi. v1'in koyu-mürekkep + signal-yeşil + Geist yönü TERK EDİLDİ. Yeni yön: high-end editorial luxury, off-white zemin, kırmızı+altın tipografi accent, Zodiak+Switzer. Karar 2026-06-22 trend araştırmasıyla (Awwwards/editorial-luxury/anti-slop) desteklendi.

---

## 1. Çekirdek karakter (ruh)

**"Editorial luxury + credibility"** — lüks his **gösterişten değil, boşluk + tipografiden** gelir (Hermès / editorial dergi mantığı; casino DEĞİL).

- "Kanıt & sağlamlık" ruhu korunur ama editorial-luxury kılıfında. Developer/web3 ürünü → **inandırıcılık ön planda** (gerçek tx, gerçek sayı; "lightning fast" değil "23ms").
- His çapası: sakin, pahalı, kasıtlı. Her boşluk ve her aksan bilinçli.
- Reddedilen: salt-gösteri (WebGL/3D vitrin), casino (siyah+kırmızı+altın fill), jenerik SaaS (centered + Inter başlık + uniform radius).

## 2. Renk & atmosfer (off-white zemin, accent ÇOK az)

| Rol | Token | Hex | Kullanım |
|-----|-------|-----|----------|
| Zemin | `--bg` | `#F5F0EA` | keten-krem off-white. **Asla saf `#fff`** (ucuz). Sıcak yön. |
| Metin | `--text` | `#1A1714` | sıcak near-black. **Asla saf `#000`.** |
| Muted metin | `--muted` | `#6B645C` | ikincil metin / etiket |
| Hairline | `--line` | `rgba(26,23,20,0.10)` | section ayraç + ince çizgi |
| Accent kırmızı | `--accent-red` | `#ad0013` | ~%2.5 görünürlük |
| Accent altın | `--accent-gold` | `#a67d43` | ~%1.5 görünürlük |

- **Kırmızı `#ad0013` SADECE:** (a) başlıktaki tek vurgu kelimesi, (b) section arası `1px` yatay çizgi. Buton/ikon/border/badge'de YOK.
- **Altın `#a67d43` SADECE:** (a) H2 altı ~48px ince underline mark, (b) footer ornament / logo detay, (c) hover underline rengi.
- **KRİTİK:** kırmızı + altın **aynı elementte asla birlikte** (casino tuzağı). Toplam accent görünürlüğü sayfanın ~%4'ünü geçmez.
- Surface/kart gerekiyorsa: zeminden çok hafif fark (`#FBF8F3` veya hairline border) — koyu kutu yok.

## 3. Tipografi

Lüks his tipografiden gelir. Slop fontları yasak.

- **Display/başlık:** **Zodiak** (Fontshare, ücretsiz) — yüksek kontrastlı serif, dergi başlığı. `clamp(3rem,8vw,7.5rem)`, tracking `-0.015em`.
- **Gövde:** **Switzer** (Fontshare) — temiz grotesk, 17–18px, line-height `1.75`, max satır `65–75ch`.
- **Mono:** `JetBrains Mono` — yalnızca tx hash, adres, skor, sayısal veri.
- **Başlıkta tek anahtar kelime kırmızı** (her H1'de bir kez): "Agent **Trust** Layer".
- Küçük etiketler: uppercase Switzer, tracking `+0.10em` ("PROTOCOL LAYER").
- ⚠️ **Inter/Poppins başlık YASAK** (AI-slop sinyali). Inter sadece gerekiyorsa UI mikro-metinde; başlık asla.

## 4. Layout & kompozisyon (2026 editorial standardı)

- **Asimetrik editorial:** 2:3 / 3:5 sütun oranları. **Asla 50/50, asla ortalanmış hero.**
- Container `max-width: ~1200px` (1400px+ ecommerce hissi → hayır).
- Section padding dikey `clamp(7rem, 15vw, 15rem)` (160–240px aralığı) — cömert boşluk = lüks dili.
- **Hairline divider'lar** (`--line`), section arası `1px` kırmızı yatay çizgi imzası (tekrar eden).
- **Number tokens** `01 / 02 / 03` (uppercase light) + kategori etiketleri.
- Spacing varyasyonu **kasıtlı**: bazı section yoğun, bazı nefes alan (monoton ritim = slop).
- Spacing token sistemi: `8/16/24/40/64/96/128`. Uniform `border-radius: 12-16px` her yerde YASAK (slop).

## 5. Hareket felsefesi

- **Hafif, editorial.** Lüks = whitespace + tipografi; motion DEĞİL.
- İzin: staggered fade-in (`Reveal`), hover transform (underline + letter-spacing), hairline reveal.
- **YASAK:** WebGL/3D hero, kinetic typography (layout-shift → CWV fail), full-page glassmorphism, ağır parallax.
- Performans hard-kuralları (korunur): `transform`+`opacity` only, IntersectionObserver/`useScroll` (scroll listener yok), `prefers-reduced-motion` respect, cleanup zorunlu.

## 6. Hero centerpiece (editorial revize)

Önceki "canlı animasyonlu 3D/data-viz" YERİNE → **editorial, sayı-odaklı, sakin** sunum:
- Gerçek veri: agent#0 `scoreBps 208`, `jobsCompleted 4`, gerçek settlement tx'ler (`24f1914a…`, `50b6d34d…`, `1328ffa5…`, `0c58d79a…`, `b4a4635f…`) + cspr.live linkleri.
- Sunum: büyük mono sayı + hairline + tx satırları (editorial liste), minimal hareket. "Kanıt burada" — gösterişsiz inandırıcılık.
- Snapshot kaynağı: `loadSnapshot()` (build-time, runtime RPC yok).

## 7. Casper uyum stratejisi (değişmedi)

- Fonksiyonel (yüksek puan): canlı testnet verisi + cspr.live tx kanıt linkleri + `casper-trust` SDK read + motes→CSPR util. Cüzdan (CSPR.click) dashboard fazı.
- İnce marka: "Built on Casper" — ama editorial, sade (badge gösterişsiz). Casper kırmızısı ayrımı: bizim kırmızı `#ad0013` zaten accent; Casper logosu footer'da nötr.

## 8. Üretim disiplini — anti-AI-slop (light premium)

**Slop sinyalleri (YASAK):** saf `#fff` zemin + saf `#000` metin · Inter/Poppins başlık · uniform `border-radius` her yerde · ortalanmış hero + centered feature grid · purple→blue gradient · Lucide/Heroicons doğrudan · "Build the future" tarzı boş başlık · tüm section aynı yükseklik/yapı · Tailwind default `box-shadow` · stock foto.
**Craft moves (ZORUNLU):** asimetrik tipografik layout · tek kırmızı vurgu kelimesi · tekrar eden `1px` accent çizgi imzası · kasıtlı spacing varyasyonu · `01/02` number tokens · sürprizli hover (underline + tracking) · editorial footer (ince serif alıntı + hairline + versiyon) · gerçek sayı/claim (latency/throughput/skor) + gerçek contract/tx.

## 9. Teknik stack

- Next.js (App Router) + Tailwind v4 (off-white token'lar `@theme`).
- **Fontlar:** Zodiak + Switzer (Fontshare) → `next/font/local` (woff2 indir) VEYA Fontshare CSS API; JetBrains Mono (`next/font/google`).
- `framer-motion` (Reveal/hover). GSAP/StickyStack muhtemelen GEREKSİZ (editorial, ağır scroll yok) — kaldırılabilir.
- Casper: `casper-trust` (read) · cspr.cloud (build-time snapshot).
- Hosting: Cloudflare.

## 10. Mevcut koda etki (v1→v2 rework)

- **Task 1 (scaffold):** değişmez.
- **Task 2 (tema/font/primitives):** KOMPLE revize — off-white palet token'ları, Zodiak/Switzer fontları, primitives editorial (Section + yeni: SectionLabel, Divider, AccentWord; Badge/CodeBlock/Stat light'a uyarlanır).
- **Task 3 (data):** değişmez (snapshot/read; veri boost edildi).
- **Task 4 (motion):** Reveal + reduced-motion korunur; StickyStack editorial'de gerekmeyebilir.
- **Task 5 (Hero):** KOMPLE yeniden tasarım (editorial, off-white, kırmızı vurgu kelime, Zodiak, sayı-odaklı centerpiece).
- **Task 6-9:** yeni section'lar editorial yönde.

## 11. Sonraya bırakılanlar

- Zodiak/Switzer kesin yükleme yolu (next/font/local woff2 vs Fontshare CSS) — Task 2'de netleşir.
- Section yapısı (7 bölüm) korunur: Hero · Problem · How it works · x402 trust-gating · Live proof · Developer/SDK · Footer.
- Bento kullanılacak section (varsa) — implementasyonda.
