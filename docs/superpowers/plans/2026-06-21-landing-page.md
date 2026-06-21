# Casper Trust Layer — Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Casper Trust Layer için premium, web3 tarzı, performanslı bir landing page — DNA spec'e (`docs/superpowers/specs/2026-06-21-landing-design-dna.md`) sadık.

**Architecture:** Yeni `web/` dizininde Next.js (App Router) uygulaması. Tema token'ları CSS-first (Tailwind v4). Veri katmanı `casper-trust` SDK ile testnet'ten **build-zamanı snapshot** çeker (runtime RPC bağımlılığı yok → demo güvenilir). Section'lar saf sunum; animasyon framer-motion (UI/reveal) + GSAP ScrollTrigger (pin/scrub imza anları), ikisi izole. Cüzdan bağlama landing'de YOK (dashboard fazı).

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind v4 + framer-motion + gsap (ScrollTrigger) + `casper-trust` (npm 0.1.1) + next/font. Test: Vitest (+ Testing Library) sadece veri/util/hook için; section'lar build + görsel checklist. Hosting: Cloudflare.

## Global Constraints

Her task'ın gereksinimleri bu bölümü kapsar. Değerler DNA spec'ten verbatim:

- **Renk token'ları:** `--bg #0A0B0D` · `--surface #14161A` · `--text #E8EAED` · `--accent #2BD9A0`. Diğer tonlar (muted/border/accent-hover) bu 4 kökten türetilir. **Casper kırmızısı KULLANILMAZ.**
- **Accent disiplini:** yeşil yalnızca canlı/doğrulanmış/settled durumları + birincil CTA. Süs olarak dağıtma.
- **Tipografi:** display = Geist (next/font); body = Inter; mono = JetBrains Mono (adres/tx/skor/sayı). Kontrast boyut+weight+mono ile.
- **Hareket:** MOTION 5-6 (az ama keskin). Sadece `transform`+`opacity` animate et. `window.addEventListener("scroll")` YASAK → `useScroll`/ScrollTrigger/IntersectionObserver. GSAP ve framer-motion **aynı component ağacında karışmaz**. GSAP cleanup `return () => ctx.revert()`. Scroll/cursor değerleri `useMotionValue`+`useTransform`. `prefers-reduced-motion` her MOTION>3 efektte respect edilir. Spring default `stiffness:100, damping:20`.
- **Kompozisyon:** DENSITY 3-4 (bol nefes, `py-28`+ section aralıkları), VARIANCE 6-7 (kontrollü asimetri), her section TEK güçlü odak. `<768px` asimetrik layout tek kolona çöker.
- **Anti-slop kapısı (her section sonu):** hero ≤1-3 satır; nested box yok (card-in-card); micro-UI clutter yok (sahte pill/label); spacing oranları korundu; palet 4 token'la eşleşti; küçük laptop'ta hero temiz/okunur.
- **Kod:** placeholder/`// ... rest` yasak; tam dosya ya da temiz breakpoint. Named export tercih. Dosya başına tek sorumluluk, ~150 LOC hedef.

---

## File Structure

```
web/
  package.json · next.config.ts · tsconfig.json · vitest.config.ts
  app/
    layout.tsx            # html shell, next/font, metadata/OG
    page.tsx              # section'ları compose eder
    globals.css           # @theme token'ları, base reset
  components/
    ui/
      Section.tsx         # dikey ritim + container primitive
      Badge.tsx           # "Built on Casper" + durum rozeti
      CodeBlock.tsx       # mono kod snippet (kopyala)
      Stat.tsx            # mono sayısal değer + label
    motion/
      MotionConfig.tsx    # reduced-motion provider + spring preset
      Reveal.tsx          # framer whileInView reveal
      StickyStack.tsx     # GSAP sticky-stack (izole, kendi ağacı)
    sections/
      Hero.tsx · Centerpiece.tsx · Problem.tsx · HowItWorks.tsx
      TrustGating.tsx · LiveProof.tsx · Developer.tsx
      FinalCta.tsx · SiteFooter.tsx
  lib/
    casper/
      read.ts             # casper-trust SDK wrapper (read-only)
      types.ts            # AgentSnapshot, ReputationSnapshot tipleri
    data/
      snapshot.json       # dondurulmuş testnet verisi (script üretir)
      snapshot.ts         # snapshot.json loader + tip guard
    content.ts            # tüm section metinleri (tek kaynak)
  scripts/
    fetch-snapshot.mts    # testnet'ten gerçek veri → snapshot.json
  public/                 # casper-wordmark.svg, og.png
```

**Test edilebilirlik notu:** `lib/` (data/casper/content) ve `components/motion` saf mantık → Vitest ile TDD. `components/sections` görsel → build + görsel checklist (tam JSX implementer tarafından DNA'ya göre yazılır; plan dosya/props/içerik/doğrulamayı tanımlar). Bu kasıtlı: section JSX'ini plana gömmek hem şişirir hem görsel iterasyonu kilitler.

---

### Task 1: Proje scaffold + tooling

**Files:**
- Create: `web/` (create-next-app çıktısı), `web/vitest.config.ts`
- Modify: repo kök `.gitignore` (web/node_modules, web/.next)

**Interfaces:**
- Produces: çalışan Next.js app `web/`, `npm run dev`/`build`/`test` script'leri.

- [ ] **Step 1:** `web/` içine app oluştur (repo kökünden):
```bash
cd web 2>/dev/null || npx create-next-app@latest web --ts --tailwind --app --eslint --src-dir=false --import-alias "@/*" --no-turbopack
```
Sorulursa: App Router yes, Tailwind yes, src dir no, import alias `@/*`.
- [ ] **Step 2:** Bağımlılıkları ekle:
```bash
cd web && npm i framer-motion gsap casper-trust && npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
```
- [ ] **Step 3:** `web/vitest.config.ts` yaz (jsdom env, react plugin, globals true). `web/package.json` scripts'e `"test": "vitest run"`, `"test:watch": "vitest"`, `"snapshot": "node --import tsx scripts/fetch-snapshot.mts"` ekle; `tsx` devDep ekle.
- [ ] **Step 4:** Doğrula — build + test boş geçer:
```bash
cd web && npm run build && npm run test
```
Expected: build success; vitest "no test files" (henüz test yok) — bu aşamada kabul.
- [ ] **Step 5:** Commit:
```bash
git add web .gitignore && git commit -m "chore(web): scaffold next.js app + tooling"
```

---

### Task 2: Tema token'ları + fontlar + UI primitives

**Files:**
- Modify: `web/app/globals.css`, `web/app/layout.tsx`
- Create: `web/components/ui/Section.tsx`, `Badge.tsx`, `CodeBlock.tsx`, `Stat.tsx`

**Interfaces:**
- Produces:
  - CSS değişkenleri `--bg --surface --text --accent` + Tailwind v4 `@theme` eşlemesi (`bg-bg`, `text-text`, `text-accent` vb.)
  - `<Section id padded>` — max-w container + dikey ritim
  - `<Badge variant="casper"|"live">` — rozet
  - `<CodeBlock code lang>` — mono blok + kopyala butonu
  - `<Stat value label mono>` — sayısal vurgu

- [ ] **Step 1:** `globals.css` — `@theme` içinde 4 token + türev tonlar (muted `#8A8F98`, border `#23262D`, accent-dim `#1C9C74`), base reset (bg/text uygula, font değişkenleri bağla). Tailwind v4 token formuna dikkat ([[feedback_ide_autofix_tailwind_v4]]: `text-text` theme-token formu, parens-form değil).
- [ ] **Step 2:** `layout.tsx` — next/font: `Geist` (display, `--font-display`), `Inter` (`--font-sans`), `JetBrains_Mono` (`--font-mono`). `<html>` `lang="en"`, body bu değişkenleri taşır. Metadata: title "Casper Trust Layer", description, OG.
- [ ] **Step 3:** 4 primitive'i yaz (her biri named export, tek sorumluluk, ≤60 LOC). `CodeBlock` kopyala-state'i `useState` ile (animasyon değil, OK).
- [ ] **Step 4:** Geçici `page.tsx`'e primitive'leri yerleştir, doğrula:
```bash
cd web && npm run build && npm run dev
```
Görsel checklist: zemin `#0A0B0D`, metin kırık-beyaz, accent yeşil sadece Badge/Stat'ta, 3 font ayrışıyor.
- [ ] **Step 5:** Commit: `feat(web): theme tokens, fonts, ui primitives`

---

### Task 3: Casper read katmanı + testnet snapshot

**Files:**
- Create: `web/lib/casper/types.ts`, `read.ts`, `web/lib/data/snapshot.ts`, `web/scripts/fetch-snapshot.mts`, `web/lib/data/snapshot.json`
- Test: `web/lib/data/snapshot.test.ts`, `web/lib/casper/read.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: `type AgentSnapshot = { agentId: number; scoreBps: number; jobsCompleted: number; exists: boolean }`; `type TrustSnapshot = { capturedAt: string; network: "casper-test"; agents: AgentSnapshot[]; settlements: SettlementProof[] }`; `type SettlementProof = { txHash: string; from: number; to: number; amount: string; scoreBefore: number; scoreAfter: number }`
  - `read.ts`: `createReadClient()`, `getReputation(agentId): Promise<AgentSnapshot>` (casper-trust SDK delege)
  - `snapshot.ts`: `loadSnapshot(): TrustSnapshot` (snapshot.json import + tip guard `assertTrustSnapshot`)

- [ ] **Step 1: Failing test** — `snapshot.test.ts`: `loadSnapshot()` geçerli şekil döndürür (agents non-empty, her agent scoreBps 0-10000, settlements txHash 64-hex).
```ts
import { loadSnapshot } from "./snapshot";
test("snapshot has valid shape", () => {
  const s = loadSnapshot();
  expect(s.agents.length).toBeGreaterThan(0);
  for (const a of s.agents) expect(a.scoreBps).toBeGreaterThanOrEqual(0);
  for (const p of s.settlements) expect(p.txHash).toMatch(/^[0-9a-f]{64}$/);
});
```
- [ ] **Step 2:** Run → FAIL (snapshot.ts + json yok).
- [ ] **Step 3:** `types.ts` yaz. `snapshot.ts` yaz (`assertTrustSnapshot` zod-style el-guard veya zod ekle). Geçici `snapshot.json`'a **gerçek** seed koy: memory'deki canlı tx'ler (`0c58d79ae9c5...`, `b4a4635f...`, hero-loop `00c84d17...`) + agent #0 scoreBps 100→... gerçek değerler. (Bu manuel seed; Step 6 script ile yenilenir.)
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Failing test** — `read.test.ts`: `getReputation` SDK çağrısını doğru parse eder (SDK mock: `{exists:true, scoreBps:9400n, jobsCompleted:3n}` → number'a dönüşür). ⚠️ [[feedback_verify_live_not_mock]]: mock'u SDK'nın GERÇEK dönüş şekline göre kur (bigint alanlar).
- [ ] **Step 6:** `read.ts` yaz (casper-trust `createTrustClient`/`getReputation` delege, bigint→number). `fetch-snapshot.mts` yaz: testnet'ten birkaç agent + bilinen settlement tx'lerini çekip `snapshot.json` üret (.env'den RPC/config). Run → PASS. `npm run snapshot` ile json'u canlıdan tazele (RPC erişilebilirse; değilse manuel seed kalır — demo build-time olduğu için OK).
- [ ] **Step 7:** Commit: `feat(web): casper read layer + testnet snapshot`

---

### Task 4: Animasyon altyapısı (izole, performanslı)

**Files:**
- Create: `web/components/motion/MotionConfig.tsx`, `Reveal.tsx`, `StickyStack.tsx`
- Test: `web/components/motion/Reveal.test.tsx`

**Interfaces:**
- Produces:
  - `MotionConfig`: client provider; `prefers-reduced-motion` okur, context'le `reduce: boolean` + spring preset (`{type:"spring",stiffness:100,damping:20}`) verir.
  - `Reveal`: `<Reveal delay?>` — framer `whileInView` (opacity/y), `viewport once`, reduce ise anlık.
  - `StickyStack`: `<StickyStack>{cards}</StickyStack>` — GSAP ScrollTrigger pin+scale, **kendi ağacında** (içinde framer yok), `ctx.revert()` cleanup, reduce ise düz liste.

- [ ] **Step 1: Failing test** — `Reveal.test.tsx`: reduce-motion true iken çocuk anında görünür (opacity 1, animasyon yok). matchMedia mock'la.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** `MotionConfig` + `Reveal` yaz (Global Constraints hareket kurallarına birebir uy). `StickyStack` yaz (DNA spec §4 GSAP iskeleti; `gsap.context` + `ctx.revert`).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit: `feat(web): motion primitives (reveal, sticky-stack, reduced-motion)`

---

### Task 5: Hero + Centerpiece (canlı trust-settlement viz)

**Files:**
- Create: `web/components/sections/Hero.tsx`, `Centerpiece.tsx`
- Modify: `web/lib/content.ts` (hero metni), `web/app/page.tsx`

**Interfaces:**
- Consumes: `loadSnapshot()` (Task 3), `Reveal`/`MotionConfig` (Task 4), `Badge`/`Stat` (Task 2).
- Produces: `<Hero>` (page'in ilk section'ı), `<Centerpiece data={TrustSnapshot}>`.

**İçerik (`content.ts`):** başlık ≤6 kelime ("Trust, settled on-chain." benzeri — implementer DNA'ya göre keskinleştirir); alt başlık 1 cümle (objective, escrow-derived reputation for AI agents); CTA `npm install casper-trust` (CodeBlock) + ikincil "View on npm". Badge "Built on Casper".

**Centerpiece davranışı:** snapshot'tan akış animasyonu — agent düğümleri → x402 ödeme oku → settle → scoreBps artışı (Stat mono, yeşil). framer `useMotionValue` ile sayaç; SVG/div transform, **canvas/WebGL YOK** (hafif). reduce ise statik son-durum.

- [ ] **Step 1:** `content.ts`'e hero içeriğini ekle (tek kaynak).
- [ ] **Step 2:** `Centerpiece.tsx` yaz — snapshot prop, transform+opacity animasyon, reduced-motion statik fallback, mono Stat'lar.
- [ ] **Step 3:** `Hero.tsx` yaz — asimetrik layout (VARIANCE 6-7), display başlık (grafik öğesi), Centerpiece sağ/arka, CTA + Badge. `page.tsx`'e ekle.
- [ ] **Step 4:** Doğrula:
```bash
cd web && npm run build && npm run dev
```
Görsel checklist (anti-slop kapısı): başlık ≤3 satır; centerpiece akıyor ama dikkat dağıtmıyor; accent yeşil sadece skor/CTA; `<768px` tek kolon + statik centerpiece; Lighthouse perf hızlı (canvas yok).
- [ ] **Step 5:** Commit: `feat(web): hero + live trust-settlement centerpiece`

---

### Task 6: Problem + How it works

**Files:**
- Create: `web/components/sections/Problem.tsx`, `HowItWorks.tsx`
- Modify: `web/lib/content.ts`, `web/app/page.tsx`

**Interfaces:**
- Consumes: `Reveal`, `StickyStack` (Task 4), `Section`/`Stat` (Task 2).
- Produces: `<Problem>`, `<HowItWorks>` (3 adım sticky-stack: identity → escrow settlement → objective reputation).

- [ ] **Step 1:** `content.ts` — Problem (AI agent'lar birbirine güvenemez; self-report itibar uydurulur; kısa keskin) + 3 adım metinleri.
- [ ] **Step 2:** `Problem.tsx` — tek odak, büyük tipografi ifade, `Reveal`. Yaz.
- [ ] **Step 3:** `HowItWorks.tsx` — `StickyStack` ile 3 kart (her kart: adım no mono, başlık, 1-2 cümle, ince accent). Yaz, `page.tsx`'e ekle.
- [ ] **Step 4:** Doğrula (build + dev): sticky-stack pürüzsüz pinleniyor, reduce'da düz liste, mobilde stack düşüyor. Anti-slop kapısı.
- [ ] **Step 5:** Commit: `feat(web): problem + how-it-works (sticky-stack)`

---

### Task 7: x402 Trust-gating + Live proof (kanıt section'ları)

**Files:**
- Create: `web/components/sections/TrustGating.tsx`, `LiveProof.tsx`
- Modify: `web/lib/content.ts`, `web/app/page.tsx`

**Interfaces:**
- Consumes: `loadSnapshot()` (settlements + agents), `Reveal`, `Badge`, `Stat`, `CodeBlock`.
- Produces: `<TrustGating>` (aynı endpoint, minScore'a göre PAID vs REFUSED — iki kolon karşılaştırma), `<LiveProof data>` (gerçek tx'ler + cspr.live linkleri).

**TrustGating içerik:** Senaryo A `minScore 101 → REFUSED` (TrustGateError, ödeme zincire gitmedi); Senaryo B `minScore 100 → PAID` (settle tx). Aynı provider, sadece güven barı değişti = tez. Mono kod + durum rozeti.

**LiveProof içerik:** snapshot.settlements her biri → satır: txHash (mono, kısalt) + scoreBefore→scoreAfter + `cspr.live/transaction/<hash>` linki (yeni sekme). Başlık "Verifiable on-chain. Not a claim."

- [ ] **Step 1:** `content.ts` — trust-gating iki senaryo + live-proof başlık/etiketler.
- [ ] **Step 2:** `TrustGating.tsx` — iki kolon (REFUSED nötr/kırmızı-değil-gri, PAID accent yeşil), `Reveal`. Yaz.
- [ ] **Step 3:** `LiveProof.tsx` — snapshot.settlements map, cspr.live link util (`https://testnet.cspr.live/transaction/${hash}`), mono satırlar. Yaz, `page.tsx`'e ekle.
- [ ] **Step 4:** Doğrula: tx linkleri gerçek cspr.live sayfasına gidiyor (en az 1 link manuel tıkla), scoreBefore→after gerçek snapshot'tan, accent disiplini.
- [ ] **Step 5:** Commit: `feat(web): trust-gating + live on-chain proof`

---

### Task 8: Developer/SDK + Final CTA + Footer

**Files:**
- Create: `web/components/sections/Developer.tsx`, `FinalCta.tsx`, `SiteFooter.tsx`
- Modify: `web/lib/content.ts`, `web/app/page.tsx`, `web/public/casper-wordmark.svg`

**Interfaces:**
- Consumes: `CodeBlock`, `Badge`, `Section`.
- Produces: `<Developer>` (install + checkTrust/pay snippet), `<FinalCta>`, `<SiteFooter>`.

**Developer içerik:** `npm install casper-trust` + minimal snippet:
```ts
import { createTrustClient } from "casper-trust";
const trust = createTrustClient();
const { scoreBps } = await trust.getReputation(agentId);
await trust.pay({ minScore: 9000 }); // trust-gated x402
```
Linkler: npmjs.com/package/casper-trust, github repo.

**Footer:** "Built on Casper" wordmark (public/svg, kendi rengi minik kabul) + github/npm/docs linkleri. Casper kırmızısı gövdede yok.

- [ ] **Step 1:** `content.ts` — developer metni + snippet + footer linkleri. `casper-wordmark.svg` ekle (casper.network media kit veya basit wordmark).
- [ ] **Step 2:** `Developer.tsx` yaz (CodeBlock snippet, mono, kopyala).
- [ ] **Step 3:** `FinalCta.tsx` + `SiteFooter.tsx` yaz. `page.tsx`'e ekle (tam akış tamamlanır).
- [ ] **Step 4:** Doğrula: snippet kopyalanıyor, npm/github linkleri doğru, footer wordmark görünüyor.
- [ ] **Step 5:** Commit: `feat(web): developer section, final cta, footer`

---

### Task 9: Sayfa cilası — responsive, performans, SEO, Cloudflare deploy

**Files:**
- Modify: `web/app/page.tsx`, `web/app/layout.tsx`, tüm section'lar (responsive geçiş)
- Create: `web/app/opengraph-image.tsx` (veya public/og.png), `web/next.config.ts` (Cloudflare), `web/public/robots.txt`

**Interfaces:**
- Produces: production-ready, deploy edilmiş landing.

- [ ] **Step 1:** Responsive geçiş — her section `<768px` tek kolon + statik motion; `md`/`lg` breakpoint'lerde DNA layout. dev tools mobil/tablet/desktop manuel.
- [ ] **Step 2:** Performans — Lighthouse audit (`npm run build && npm start`, chrome-devtools lighthouse): perf ≥90 hedef. Görseller optimize, font display swap, gereksiz JS yok. Centerpiece reduced-motion'da statik.
- [ ] **Step 3:** SEO/OG — metadata tam (title/description/og image), `opengraph-image`, robots.txt. cspr.live linkleri `rel="noopener" target="_blank"`.
- [ ] **Step 4:** Cloudflare deploy — `@cloudflare/next-on-pages` veya OpenNext adapter; `wrangler` ile preview deploy. ([[feedback_hosting_cloudflare]] production default.) Deploy URL'i doğrula (canlı açılıyor, centerpiece + tx linkleri çalışıyor).
- [ ] **Step 5:** Commit + push: `feat(web): responsive polish, perf, seo, cloudflare deploy` → `git push`.

---

## Self-Review

**Spec coverage:** DNA spec §1 karakter → tüm section ton; §2 renk → Task 2 token'lar + Global Constraints; §3 tipografi → Task 2 fontlar; §4 hareket → Task 4 + Global Constraints; §5 kompozisyon → her section task + constraints; §6 centerpiece → Task 5; §7 Casper uyum → Task 3 (read/snapshot) + Task 7 (live proof/cspr.live) + Task 8 (badge/wordmark) — **cüzdan landing'de kapsam dışı (dashboard fazı), bilinçli**; §8 üretim disiplini → Global Constraints + her görsel task'ın anti-slop checklist'i; §9 stack → Task 1-2; §10 açık kararlar → font (Task 2 Geist), centerpiece veri (Task 3 snapshot), section yapısı (bu plan), Spline (kapsam dışı, YAGNI).

**Placeholder scan:** Section task'ları kasıtlı olarak tam JSX içermez (gerekçe File Structure notunda) — bunlar "what + where + content + verify" tanımlı, "TODO" değil. Veri/util/motion task'ları tam kod + test içerir. Kabul.

**Type consistency:** `AgentSnapshot`/`TrustSnapshot`/`SettlementProof` Task 3'te tanımlı, Task 5/7'de aynı isimlerle tüketiliyor. `getReputation`/`loadSnapshot`/`createReadClient` tutarlı.

**Açık risk:** Tailwind v4 token formu ([[feedback_ide_autofix_tailwind_v4]]) ve Cloudflare Next adapter (Task 9) implementasyonda dikkat ister — ikisi de not edildi.
