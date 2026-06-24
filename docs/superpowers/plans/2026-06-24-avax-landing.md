# avax-DNA Landing Transform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute task-by-task. Steps use checkbox (`- [ ]`) syntax.
> **Visual gate:** Tasks marked **[VISUAL CHECKPOINT]** stop for Bekir+Gemini approval before the next task. The plan fixes STRUCTURE (layout pattern, primitives, data, motion wiring); fine visual detail (exact accent tone, spacing, hover feel) is settled at the checkpoint, not frozen here. ([[feedback_frontend_design_gemini]] [[feedback_brain_drain_no_solo_uiux]])

**Goal:** Transform the existing v2-editorial landing (off-white / Zodiak / single-column-static) into the avax-DNA dark + Geist + 12-col layout (sticky-scroll · bento · asymmetric split · marquee), per `docs/superpowers/specs/2026-06-24-avax-layout-dna.md`.

**Architecture:** Theme + fonts swap at one place (globals.css + layout.tsx) — all 9 sections use semantic `font-display`/`font-sans` aliases + `bg-bg`/`text-text` tokens, so the re-skin propagates without per-section font edits. Then new layout primitives, then each section re-composed inward (page.tsx order unchanged). Data (snapshot.json) and motion infra (Reveal/StickyStack/MotionConfig) are preserved and reused.

**Tech Stack:** Next 16 (Turbopack, App Router) · Tailwind v4 (`@theme`) · next/font · framer-motion (Reveal) · GSAP ScrollTrigger (StickyStack) · TypeScript.

## Global Constraints

- **Next 16 is not the Next.js in your training data** — `web/AGENTS.md` mandates reading `node_modules/next/dist/docs/` before writing App-Router/next-font code. Heed it.
- Tailwind v4 token form: `bg-bg` / `text-text` / `text-accent-red` (theme tokens), NOT parens-form `text-(--var)` ([[feedback_ide_autofix_tailwind_v4]]).
- Motion: `transform`+`opacity` only; GSAP and framer trees kept ISOLATED (never animate the same node); `ctx.revert()` cleanup; all motion reactive to `prefers-reduced-motion`.
- Container `max-w-[1280px]`, 12-col grid where used, gutter `24px`; section vertical rhythm `clamp(6rem,10vw,10rem)` (logo-wall/marquee is the exception, `py-12`).
- Accent red is a SIGNAL only (hover / active rule / highlight word / live status) — never large fills.
- Preserve: `web/lib/data/snapshot.json` + `snapshot.ts` loader (agent#0 scoreBps=208, jobsCompleted=4, settlements[]); `web/lib/content` strings; `components/motion/*`.
- Do NOT touch the `contracts/` tree or any `.superpowers/sdd/*treasury*` files (that is the parallel contract SDD kol).
- Code quality: one responsibility per component, named exports, no dead code, follow existing section idioms.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `web/app/globals.css` | dark design tokens + font aliases | **Modify** (Task 1) |
| `web/app/layout.tsx` | Geist + mono font wiring via next/font | **Modify** (Task 1) |
| `web/components/ui/Grid.tsx` | 12-col grid wrapper | **Create** (Task 2) |
| `web/components/ui/SplitSection.tsx` | asymmetric n/m split (incl. sticky-left option) | **Create** (Task 2) |
| `web/components/ui/BentoGrid.tsx` | bounded-card grid | **Create** (Task 2) |
| `web/components/ui/Section.tsx` | extend with `grid`/`bleed`/`tone` props | **Modify** (Task 2) |
| `web/components/sections/*.tsx` | per-section re-composition | **Modify** (Tasks 3–10, one per task) |
| `web/components/ui/{CodeBlock,Stat,Badge,Divider}.tsx` | dark re-skin as touched | **Modify** (within consuming tasks) |

---

## Task 1: Dark theme tokens + Geist font wiring  **[VISUAL CHECKPOINT]**

**Files:** Modify `web/app/globals.css`, `web/app/layout.tsx`

**Interfaces:**
- Produces: dark token set (`--bg`, `--surface`, `--text`, `--muted`, `--line`, `--accent-red`) + `--font-display`/`--font-sans` pointing at Geist. All sections inherit via existing semantic classes.

- [ ] **Step 1: Wire Geist + mono in `layout.tsx`**

Replace the Zodiak/Switzer `localFont` imports with Geist. First confirm the loader: check whether `geist/font` (the `geist` npm package, already common in this stack) or `next/font/google`'s `Geist` is available — read `node_modules/next/dist/docs/` per AGENTS.md, and prefer `geist/font/sans` + `geist/font/mono` if the `geist` package is installed, else `next/font/google` `Geist`/`Geist_Mono`. Wire CSS variables `--font-geist-sans` (display+sans) and keep `--font-jetbrains-mono` (or Geist Mono) for mono. Apply the variables on `<html>` exactly as Zodiak/Switzer were applied.

- [ ] **Step 2: Swap tokens in `globals.css`**

Replace the `:root` token block:

```css
:root {
  --bg: #0A0B0D;              /* ink near-black */
  --surface: #14161A;        /* raised dark surface */
  --text: #F2F3F5;           /* near-white */
  --muted: #9AA0A6;          /* secondary grey */
  --line: rgba(255, 255, 255, 0.10);
  --accent-red: #E84142;     /* avax-referenced signal red (tone tunable at checkpoint) */

  --font-display: var(--font-geist-sans);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-jetbrains-mono);
}
```

Set `html { color-scheme: dark; }` and keep the `@theme` mapping (it already maps `--color-bg` etc. to these). Remove `--accent-gold` usages only if they break compile; otherwise leave the token defined (its fate is an open visual decision) and let later section tasks drop it.

- [ ] **Step 3: Build + lint**

Run: `cd web && npm run build` (or the project's build script). Expected: compiles; no missing-font / token errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/globals.css web/app/layout.tsx
git commit -m "feat(web): dark theme tokens + Geist font wiring"
```

- [ ] **Step 5: [VISUAL CHECKPOINT]** Start the dev server, show Bekir the landing in dark + Geist (all sections inherit). Confirm: (a) Geist is the right display font (open decision 4) or swap to General Sans/Space Grotesk; (b) accent red tone (`#E84142` vs Casper-specific). Do NOT proceed to Task 3 until approved. (Tasks 2 primitives may proceed in parallel — they don't depend on the visual verdict.)

---

## Task 2: Layout primitives (`Grid`, `SplitSection`, `BentoGrid`) + `Section` extension

**Files:** Create `web/components/ui/{Grid,SplitSection,BentoGrid}.tsx`; Modify `web/components/ui/Section.tsx`

**Interfaces:**
- Produces:
  - `Grid({ children, className })` → `<div className="grid grid-cols-12 gap-6 ...">`.
  - `SplitSection({ left, right, ratio = "5/7", stickyLeft = false, className })` → 12-col split; `ratio` maps to `lg:grid-cols-[5fr_7fr]` etc.; `stickyLeft` adds `lg:sticky lg:top-24 lg:self-start` to the left column.
  - `BentoGrid({ children, className })` → `grid grid-cols-1 md:grid-cols-3 gap-6` (cells set their own `md:col-span-*`).
  - `Section` gains `grid?: boolean` (wraps children in 12-col grid), `bleed?: boolean` (full-bleed, no max-width), `tone?: "dark" | "light"` (sets bg/text for white-rhythm sections).

- [ ] **Step 1: Write `Grid.tsx`** — minimal 12-col wrapper.

```tsx
import type { ReactNode } from "react";
export function Grid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 ${className}`}>{children}</div>;
}
```

- [ ] **Step 2: Write `SplitSection.tsx`** — asymmetric split with optional sticky left.

```tsx
import type { ReactNode } from "react";

const RATIOS: Record<string, string> = {
  "5/7": "lg:grid-cols-[5fr_7fr]",
  "7/5": "lg:grid-cols-[7fr_5fr]",
  "4/7": "lg:grid-cols-[4fr_1fr_7fr]", // 4 + offset + 7
  "3/2": "lg:grid-cols-[3fr_2fr]",
};

export function SplitSection({
  left, right, ratio = "5/7", stickyLeft = false, className = "",
}: {
  left: ReactNode; right: ReactNode; ratio?: keyof typeof RATIOS | string;
  stickyLeft?: boolean; className?: string;
}) {
  const cols = RATIOS[ratio] ?? RATIOS["5/7"];
  return (
    <div className={`grid grid-cols-1 ${cols} gap-10 lg:gap-12 ${className}`}>
      <div className={stickyLeft ? "lg:sticky lg:top-24 lg:self-start" : ""}>{left}</div>
      <div>{right}</div>
    </div>
  );
}
```

- [ ] **Step 3: Write `BentoGrid.tsx`** — cells assign their own span.

```tsx
import type { ReactNode } from "react";
export function BentoGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}>{children}</div>;
}
```

- [ ] **Step 4: Extend `Section.tsx`** — add `grid`/`bleed`/`tone` props (keep current default behavior identical for existing callers).

```tsx
import type { ReactNode } from "react";

interface SectionProps {
  id?: string; padded?: boolean; className?: string; children: ReactNode;
  bleed?: boolean; tone?: "dark" | "light";
}

export function Section({ id, padded = true, className = "", children, bleed = false, tone = "dark" }: SectionProps) {
  const toneCls = tone === "light" ? "bg-text text-bg" : "bg-bg text-text";
  return (
    <section
      id={id}
      className={[
        bleed ? "w-full" : "w-full mx-auto max-w-[1280px]",
        padded ? "px-6 md:px-12 [padding-block:clamp(6rem,10vw,10rem)]" : "",
        toneCls,
        className,
      ].filter(Boolean).join(" ")}
    >
      {children}
    </section>
  );
}
```

- [ ] **Step 5: Build + commit**

Run `cd web && npm run build` → compiles. Then:
```bash
git add web/components/ui/Grid.tsx web/components/ui/SplitSection.tsx web/components/ui/BentoGrid.tsx web/components/ui/Section.tsx
git commit -m "feat(web): 12-col layout primitives (Grid, SplitSection, BentoGrid) + Section props"
```

---

## Tasks 3–10: Section re-compositions (one task each)

Each section task: re-compose the named `web/components/sections/*.tsx` to its avax pattern per the DNA spec, using the Task-2 primitives, keeping its current data source and copy (`lib/content` / snapshot), re-skinning any `ui/` primitive it touches to dark. Preserve `Reveal` usage. Each ends with `npm run build` green + a **[VISUAL CHECKPOINT]** for Bekir+Gemini before the next task. Structural requirement is fixed below; visual detail is settled at the checkpoint.

- [ ] **Task 3 — Hero** (spec §3.1): `max-w-3xl` centered display block, dual CTA (*View Protocol* + *Launch Console*), Centerpiece preserved as a number-led dark panel below/beside. **[VISUAL CHECKPOINT]** — this is also where Geist + accent tone get final sign-off.
- [ ] **Task 4 — Problem** (spec §3.2): replace static body with a full-bleed CSS marquee strip (`Section bleed`, `py-12`) + one framing line. New tiny `Marquee` helper allowed if needed (transform-only, reduced-motion pauses). **[VISUAL CHECKPOINT]**
- [ ] **Task 5 — HowItWorks → sticky-scroll 01–04** (spec §3.3) ⭐: wire the existing `StickyStack` (GSAP) — each step becomes a `[data-sticky-card]`; left 5-col sticky step list, right 7-col scroll-driven visual (real tx flow from snapshot). Mobile: sticky off, vertical stack. Largest change; verify GSAP↔framer isolation + `ctx.revert`. **[VISUAL CHECKPOINT]**
- [ ] **Task 6 — TrustGating** (spec §3.4): `SplitSection` asymmetric; REFUSED (dark inset) vs APPROVED (dominant) cards + `minScore` mock; replace inline `<pre>` with `CodeBlock`. **[VISUAL CHECKPOINT]**
- [ ] **Task 7 — LiveProof** (spec §3.5): `BentoGrid` of settlement tiles (one scoreBps hero tile + tx tiles) from snapshot; mobile `scroll-snap` carousel. **[VISUAL CHECKPOINT]**
- [ ] **Task 8 — Developer** (spec §3.6): `BentoGrid` cells (pitch tall cell + install + usage `CodeBlock` + npm/GitHub link cells). **[VISUAL CHECKPOINT]**
- [ ] **Task 9 — FinalCta** (spec §3.7): `SplitSection` `stickyLeft` headline + right CTA blocks (real github/npm/Launch-Console links), filled/outline button affordance. **[VISUAL CHECKPOINT]**
- [ ] **Task 10 — SiteFooter** (spec §3.8): 5-col grid (`grid-cols-5`) + bottom legal/social flex, dark re-skin, REAL links (github.com/Bekirerdem/casper-trust-layer, npmjs.com/package/casper-trust). **[VISUAL CHECKPOINT]**

For each: `git add web/components/sections/<Name>.tsx` (+ any re-skinned `ui/` primitive) and commit `feat(web): <name> avax-dna layout`.

---

## Task 11: Responsive + perf + reduced-motion pass

**Files:** Modify section/primitive files as needed.

- [ ] **Step 1:** Verify every section collapses to 1-col on mobile (`<768px`), padding `64–80px`, asymmetric blocks order "text/heading before media".
- [ ] **Step 2:** Verify reduced-motion: marquee pauses, sticky-scroll falls back to static stack, Reveal/stagger disabled. Test with OS reduced-motion on.
- [ ] **Step 3:** Build + a Lighthouse/manual perf check (no layout shift from sticky/marquee; transform/opacity only).
- [ ] **Step 4:** Commit `chore(web): responsive + reduced-motion + perf pass`.

---

## Self-Review

- **Spec coverage:** §2 layout system → Tasks 1-2. §3.1–3.8 each section → Tasks 3-10. §4 Console → explicitly deferred (separate plan). §5 visual DNA (dark/Geist/red/motion) → Task 1 + per-section. §6 preserved infra → constraints + reuse. §7 build order → task order. ✅
- **Placeholder scan:** Task 1 font-loader and accent tone carry explicit "confirm at checkpoint / read AGENTS.md" notes — these are deliberate visual-decision deferrals to Bekir+Gemini, not unspecified engineering. Section tasks 3-10 give structure verbatim and defer visual detail to the named checkpoint by design (per no-solo-uiux).
- **Consistency:** primitive names (`Grid`/`SplitSection`/`BentoGrid`/`Section` props) used identically across tasks; `ratio` keys match `SplitSection` RATIOS map.

## Console (out of plan)

Console (Explorer/Playground/Treasury, spec §4) is a SEPARATE second-phase plan, written after the landing ships and after the AgentTreasury contract is live on testnet (its addresses/entry-points feed the Treasury view).
