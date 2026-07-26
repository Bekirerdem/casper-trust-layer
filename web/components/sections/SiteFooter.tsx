"use client";

import { siteFooter } from "@/lib/content";
import { loadSnapshot } from "@/lib/data/snapshot";
import { CONTRACTS, contractUrl } from "@/lib/casper/contracts";

/** Grouped, because a flat list of five links tells a visitor nothing about
 *  which one is for them. */
const COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Open your account", href: "/app" },
      { label: "Try the demo account", href: "/app" },
      { label: "Docs", href: "/docs" },
    ],
  },
  {
    heading: "Developers",
    links: [
      { label: "npm · casper-trust", href: "https://www.npmjs.com/package/casper-trust", external: true },
      { label: "GitHub", href: "https://github.com/Bekirerdem/casper-trust-layer", external: true },
      { label: "MCP server", href: "https://github.com/Bekirerdem/casper-trust-layer/tree/main/mcp", external: true },
    ],
  },
  {
    heading: "Proof",
    links: [
      { label: "Verify it in 10 minutes", href: "https://github.com/Bekirerdem/casper-trust-layer/blob/main/JUDGES.md", external: true },
      { label: "Addresses & receipts", href: "https://github.com/Bekirerdem/casper-trust-layer/blob/main/DEPLOYMENT.md", external: true },
      { label: "Testnet explorer", href: "https://testnet.cspr.live", external: true },
    ],
  },
] as const;

export function SiteFooter() {
  const snapshot = loadSnapshot();
  const vendors = snapshot.agents.length;
  const settlements = snapshot.settlements.length;

  return (
    <footer className="relative w-full border-t border-line bg-subtle" aria-label="Site footer">
      <div className="mx-auto max-w-[1200px] px-6 md:px-12 py-16 md:py-20">
        {/* The claim, and the numbers backing it, on one line. */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex max-w-[46ch] flex-col items-start gap-4">
            <span className="font-mono text-sm font-black uppercase tracking-[0.2em] text-ink">
              Casper <span className="text-accent-red">Trust</span> Layer
            </span>
            <p className="text-left font-sans text-sm leading-relaxed text-muted">{siteFooter.tagline}</p>
          </div>

          <dl className="flex items-start gap-8 sm:gap-10">
            <div className="flex flex-col">
              <dt className="order-2 mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">Vendors</dt>
              <dd className="order-1 font-mono text-2xl font-black tabular-nums text-ink">{vendors}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="order-2 mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">Paid jobs</dt>
              <dd className="order-1 font-mono text-2xl font-black tabular-nums text-ink">{settlements}</dd>
            </div>
            <div className="flex flex-col">
              <dt className="order-2 mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">Contracts</dt>
              <dd className="order-1 font-mono text-2xl font-black tabular-nums text-ink">{CONTRACTS.length}</dd>
            </div>
          </dl>
        </div>

        <div className="my-12 h-px w-full bg-line" />

        <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading} className="flex flex-col gap-4">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted">{col.heading}</span>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target={"external" in link && link.external ? "_blank" : undefined}
                      rel={"external" in link && link.external ? "noopener noreferrer" : undefined}
                      className="font-sans text-sm text-muted transition-colors duration-200 hover:text-ink"
                    >
                      {link.label}
                      {"external" in link && link.external && <span className="ml-1 text-[10px]">↗</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* The deployed set, addressable. A footer on a protocol should end in
            the thing the protocol actually is. */}
        <div className="mt-12 flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Live on casper-test
            </span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-accent-red">
              <span className="h-1 w-1 rounded-full bg-accent-red" />
              deployed &amp; wired
            </span>
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {CONTRACTS.map((c) => (
              <li key={c.name}>
                <a
                  href={contractUrl(c.pkg)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-baseline gap-1.5 font-mono text-xs text-ink transition-colors hover:text-accent-red"
                >
                  {c.name}
                  <span className="text-[10px] text-muted transition-colors group-hover:text-accent-red">
                    {c.pkg.slice(0, 6)}…
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 flex flex-col items-stretch justify-between gap-6 sm:flex-row sm:items-center">
          <p className="max-w-[50ch] text-left font-sans text-xs italic text-muted/70">
            &quot;{siteFooter.footerQuote}&quot;
          </p>
          <div className="flex flex-col items-start font-mono text-[9px] tracking-wider text-muted/40 sm:items-end">
            <span>{siteFooter.version}</span>
            <span className="mt-1">
              &copy; {new Date().getFullYear()} Casper Trust Layer. All rights reserved.
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
