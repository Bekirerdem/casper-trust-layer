"use client";

import { siteFooter } from "@/lib/content";

export function SiteFooter() {
  return (
    <footer
      className="w-full bg-[#08080A] border-t border-white/5"
      aria-label="Site footer"
    >
      <div className="mx-auto max-w-[1200px] px-6 md:px-12 py-16 md:py-24">
        
        {/* Top row: Brand & navigation */}
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-12 items-start">
          
          {/* Brand Info */}
          <div className="flex flex-col items-start gap-4">
            <span className="font-mono text-sm tracking-[0.2em] text-white font-black uppercase">
              Casper <span className="text-accent-red">Trust</span> Layer
            </span>
            <p className="font-sans text-sm text-[#8E8E93] leading-relaxed max-w-[44ch] text-left">
              {siteFooter.tagline}
            </p>
          </div>

          {/* Navigation Links */}
          <nav aria-label="Footer navigation" className="flex flex-col items-start md:items-end">
            <ul className="flex flex-col gap-3 text-left md:text-right">
              {siteFooter.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    className="font-sans text-xs font-semibold uppercase tracking-widest text-[#8E8E93] hover:text-white transition-colors duration-200"
                  >
                    {link.label}
                    {link.external && <span className="text-[10px] ml-1">↗</span>}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

        </div>

        {/* Hairline Separator */}
        <div className="my-12 w-full h-px bg-white/5" />

        {/* Bottom row: Quotes & Version */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-6">
          <p className="font-sans text-xs italic text-[#8E8E93]/70 max-w-[50ch] text-left">
            &quot;{siteFooter.footerQuote}&quot;
          </p>
          <div className="flex flex-col items-start sm:items-end font-mono text-[9px] text-[#8E8E93]/40 tracking-wider">
            <span>{siteFooter.version}</span>
            <span className="mt-1">&copy; {new Date().getFullYear()} Casper Trust Layer. All rights reserved.</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
