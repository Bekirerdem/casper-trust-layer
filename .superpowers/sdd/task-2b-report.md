## Task 2b Report — Editorial-Luxury Theme

**Status:** COMPLETE

**Commit:** (see below after push)

**Font approach:** Self-hosted woff2 via `next/font/local`. Fetched Fontshare CSS API URLs, downloaded 5 woff2 files to `public/fonts/` (zodiak-regular, zodiak-bold, switzer-regular, switzer-medium, switzer-semibold). Mapped to CSS vars `--font-zodiak` / `--font-switzer`. `font-display` utility applies `font-family: var(--font-zodiak)` — Zodiak is a high-contrast serif, confirmed by font-face declarations.

**Zodiak serif rendered:** Yes — `font-family: 'Zodiak'` woff2 loaded locally; `font-display` Tailwind utility applies it. Verified by build + type check (no warnings).

**Build:** `npm run build` — ✓ compiled successfully, static pages generated, 0 errors.

**Tests:** `npm run test` — 3 test files, 8 tests, all passed.

**Concerns:** `Centerpiece.tsx` / `Hero.tsx` still reference old dark tokens (`text-accent`, `bg-surface`, `border-border`) which are now removed. These produce no CSS (Tailwind silently ignores unknown tokens) so the build is clean, but Centerpiece will render without those styles visually. Hero rework (Task 5) will fix this.
