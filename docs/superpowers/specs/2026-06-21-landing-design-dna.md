# Casper Trust Layer — Landing Page Tasarım DNA'sı

**Tarih:** 2026-06-21
**Durum:** Onaylandı (Bekir) — implementasyon planı (writing-plans) sırada
**Kapsam:** Landing page tasarım DNA'sı. Dashboard ayrı fazda, ama DNA token'ları paylaşılır (density/motion farkı §5'te).

> Bu doküman görsel kimliğin tek kaynağıdır. Renk/tipografi/hareket/kompozisyon kararları buradan okunur. Gemini bu oturumda kullanılmadı — DNA Bekir + Claude tarafından birlikte çıkarıldı.

---

## 1. Çekirdek karakter (ruh)

**"Kanıt & sağlamlık" dominant + ince cinematic katman.**

- Ürün bir *trust altyapısı* (AI agent'ları için settled-payment trust layer). Güven = sakin, net, ölçülü güç; abartısız ama derin.
- His çapası: **"bu çalışıyor, kanıtı burada."** Developer-grade ciddiyet (Stripe / Linear referans tonu).
- Cinematic katman *ikincil*: az ama keskin hareket, bol nefes. Sakin-premium — cinematic-premium değil.
- Reddedilen yön: Casper'ın kurumsal koyu+kırmızı DNA'sı (Bekir'e hitap etmiyor) ve "creative studio / digital exhibition" salt-gösteri estetiği (developer-trust mesajını boğar).

## 2. Renk & atmosfer

Koyu, soğuk zemin + **tek** canlı accent. Web3 mor klişesinden kaçınılır.

| Rol | Token | Hex | Not |
|-----|-------|-----|-----|
| Zemin (ink) | `--bg` | `#0A0B0D` | mürekkep-siyah, soğuk |
| Yüzey/kart | `--surface` | `#14161A` | kömür |
| Metin | `--text` | `#E8EAED` | kırık beyaz |
| Accent | `--accent` | `#2BD9A0` | signal yeşil — "live / verified / settled" |

- Muted metin, border, accent-hover tonları implementasyonda bu 4 kökten türetilir (yeşilin koyu/parlak varyantları + nötr gri rampası).
- **Casper kırmızısı KULLANILMAZ.** Accent yeşil tüm vurgularda baskın.
- Yeşilin anlamı tutarlı olmalı: sadece "canlı/doğrulanmış/settled" durumları + birincil CTA. Süs olarak dağıtma.

## 3. Tipografi

Kontrast **boyut + weight + mono karışımı** ile yaratılır ("büyüklük değil kontrast"; dev tipografi grafik öğesi).

- **Display/başlık:** karakterli grotesk — `Geist` veya `Space Grotesk` (implementasyonda örnekle netleşir). Tight tracking, iri boyut.
- **Gövde:** `Inter` (nötr, okunur).
- **Mono:** `JetBrains Mono` — adres, tx hash, skor, sayısal veri. Ekosistem de-facto'su + terminal-precision hissi.

## 4. Hareket felsefesi

Hareket süs değil, **gözü yönlendirir** (kompozisyon kontrolü; IG post 2 dersi: "guided, not generated").

- Yoğunluk: **MOTION ~5-6/10** — az ama keskin.
- **Ambient:** hero'da yavaş, sürekli bir "nefes" (dikkat dağıtmayan).
- **Scroll:** choreographed reveal (stagger `whileInView`) + **1-2 imza sinematik an** (sticky-stack veya yatay settlement akışı).
- **İmza an iskeletleri** (taste-skill'den, performanslı):

  Sticky-stack (kartlar pinlenip ölçeklenir):
  ```tsx
  ScrollTrigger.create({ trigger: card, start: "top top",
    endTrigger: cardEls.at(-1), end: "top top", pin: true, pinSpacing: false });
  gsap.to(card, { scale: 0.92, opacity: 0.55, ease: "none",
    scrollTrigger: { trigger: cardEls[i+1], start: "top bottom", end: "top top", scrub: true }});
  ```
  Horizontal-pan (dikey scroll → yatay hareket, settlement akışı için):
  ```tsx
  const distance = track.scrollWidth - window.innerWidth;
  gsap.to(track, { x: -distance, ease: "none",
    scrollTrigger: { trigger: wrap, start: "top top", end: () => `+=${distance}`,
      pin: true, scrub: 1, invalidateOnRefresh: true }});
  ```
  Hafif reveal (GSAP değil, Motion):
  ```tsx
  <motion.li initial={reduce ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.3 }}
    transition={{ duration: 0.6, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }} />
  ```

- **Performans hard-kuralları (zorunlu):**
  - `window.addEventListener("scroll")` YASAK → `useScroll()` / ScrollTrigger / IntersectionObserver.
  - Sadece `transform` + `opacity` animate et.
  - GSAP useEffect cleanup zorunlu: `return () => ctx.revert()`.
  - Scroll/cursor değerleri `useMotionValue` + `useTransform`, React state DEĞİL.
  - GSAP ve framer-motion'ı **aynı component ağacında karıştırma** (frame control yarışır).
  - `prefers-reduced-motion` her MOTION>3 efektte respect edilir.
  - Spring default: `type: "spring", stiffness: 100, damping: 20`.

## 5. Kompozisyon & density

- **Dial'lar (landing):** `DESIGN_VARIANCE 6-7` / `MOTION_INTENSITY 5-6` / `VISUAL_DENSITY 3-4`.
- **Dial'lar (dashboard, sonraki faz):** `DENSITY 5-7` / `MOTION 3-4`.
- Kontrollü asimetri (kanıt & sağlamlık çok dağınık istemez), bol nefes (art-gallery hissi, `py-32`+ aralıklar).
- Her section'da **tek güçlü odak** — ne önce görülür, göz sonra nereye gider.
- Mobilde (`<768px`) asimetrik layout'lar tek kolona çöker.

## 6. Hero centerpiece

**Dekoratif 3D obje değil → canlı trust-settlement görselleştirmesi.**

- Akış: agent → x402 ödeme → on-chain settle → reputation skoru güncelleniyor.
- Gerçek/gerçekçi testnet verisiyle beslenir → hem cinematic hem **"kanıt & sağlamlık"** (gerçek veri = ürünün kalbi).
- Spline 3D objeden daha *anlamlı*, daha *hafif*, DNA'ya tam uyumlu.
- Opsiyonel: ikincil hafif Spline 3D aksanı eklenebilir (karar implementasyonda; centerpiece data-viz birincil kalır).

## 7. Casper uyum stratejisi (~%80 Bekir estetiği / %20 Casper sinyali)

Ek puan görselden değil, **fonksiyonel + içerik uyumundan** gelir (jüri kriteri: ekosistem etkisi).

- **Fonksiyonel (yüksek puan):**
  - `@make-software/csprclick-ui` ile cüzdan bağlama (ekosistem standardı; custom buton + `signIn()`).
  - Canlı testnet verisi (reputation/settlement) + cspr.live tx kanıt linkleri.
  - `casper-trust` SDK read katmanı (`checkTrust`/`getReputation`/`getAgent`) + motes→CSPR formatlama.
- **İnce marka:** "Built on Casper" badge + footer wordmark. (Badge'de Casper logosu kendi renginde minik kabul edilebilir; gerisi yeşil.)
- **Kırmızı yok.**

## 8. Üretim disiplini (taste-skill çıkarımları)

- **Kütüphane seçimi:** UI/state → Motion (`motion/react`); full-page pin/scrub → GSAP ScrollTrigger; 3D → Three/Spline. İzole tut (§4).
- **image-to-code disiplini** (Gemini görseli kullanılırsa): görseli "spec gibi oku" (exact metin, spacing oranları, tipografi ilişkileri); **anti-drift** ("görsel premium, kod jenerik" hatasını engelle); belirsiz section'ı kırpma → taze görsel ürettir; section başına ayrı görsel.
- **Anti-slop kapısı (her section sonu kontrol):** hero ≤1-3 satır; nested box yok (card-in-card); micro-UI clutter yok (sahte pill/label); spacing oranları korundu mu; palet 4 token'la eşleşti mi; küçük laptop'ta hero temiz/okunur mu.
- **Kod üretimi:** placeholder/`// ... rest` yasak; tam dosya ya da temiz breakpoint.

## 9. Teknik stack (ön — kesinleşme writing-plans'de)

- Next.js (App Router) + Tailwind. shadcn/ui gerektiğinde.
- `framer-motion` + `gsap` (ScrollTrigger), izole.
- `next/font`: display (Geist/Space Grotesk) + Inter + JetBrains Mono.
- Casper: `@make-software/csprclick-ui` (cüzdan) · `casper-trust` (read) · cspr.cloud (data).
- Hosting: Cloudflare (production default).

## 10. Sonraya bırakılanlar (writing-plans / implementasyon)

- Display font kesin seçimi (Geist vs Space Grotesk) — örnekle karşılaştır.
- İkincil Spline 3D aksanı eklenecek mi.
- Section yapısı (hangi bölümler, sıra) — writing-plans'de netleşir.
- Centerpiece data-viz'in veri kaynağı: canlı RPC mi, snapshot mı (performans/güvenilirlik dengesi).
