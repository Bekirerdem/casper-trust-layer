import { siteFooter } from "@/lib/content";

export function SiteFooter() {
  return (
    <footer
      className="w-full bg-bg"
      aria-label="Site footer"
    >
      {/* Gold hairline — single thin ornament */}
      <div
        aria-hidden
        className="w-full h-px"
        style={{ background: "var(--accent-gold)", opacity: 0.5 }}
      />

      {/* Hairline line divider */}
      <div className="w-full h-px border-t border-line" aria-hidden />

      <div className="mx-auto max-w-[1200px] px-6 md:px-12 py-16 md:py-20">

        {/* Top row: wordmark + links — asymmetric, editorial */}
        <div className="grid grid-cols-1 gap-12 sm:grid-cols-[2fr_1fr] sm:gap-8 sm:items-start">

          {/* Wordmark — Zodiak text mark, not a logo SVG */}
          <div className="flex flex-col gap-4">
            <p className="font-display text-[clamp(1.5rem,3vw,2.25rem)] font-semibold leading-[1.0] tracking-[-0.01em] text-text">
              {siteFooter.wordmark}
            </p>
            <p className="font-sans text-[14px] leading-[1.7] text-muted max-w-[42ch]">
              {siteFooter.tagline}
            </p>
          </div>

          {/* Links — editorial list, not a grid dump */}
          <nav aria-label="Footer navigation">
            <ul className="flex flex-col gap-3">
              {siteFooter.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="font-sans text-[13px] text-muted hover:text-text transition-colors underline underline-offset-4 decoration-line hover:decoration-text"
                  >
                    {link.label}
                    {link.external && (
                      <span aria-hidden className="ml-1">↗</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

        </div>

        {/* Hairline separator */}
        <div className="mt-16 w-full h-px border-t border-line" aria-hidden />

        {/* Bottom row: serif editorial one-liner + mono version */}
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

          {/* Editorial footer seriousness — thin serif quote */}
          <p className="font-display text-[13px] font-normal italic leading-[1.6] text-muted max-w-[52ch]">
            {siteFooter.footerQuote}
          </p>

          {/* Mono version snapshot */}
          <p className="font-mono text-[10px] text-muted/50 tabular-nums whitespace-nowrap sm:text-right">
            {siteFooter.version}
          </p>

        </div>

      </div>
    </footer>
  );
}
