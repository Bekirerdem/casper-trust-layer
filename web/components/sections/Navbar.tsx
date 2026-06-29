"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { label: "Mechanism", href: "#how-it-works" },
    { label: "Trust-Gating", href: "#trust-gating" },
    { label: "Live Proof", href: "#live-proof" },
    { label: "Developer", href: "#developer" },
  ];

  // The dashboard (/app) has its own header — hide the marketing navbar there.
  if (pathname?.startsWith("/app")) return null;

  return (
    <header
      className={`fixed top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-[1200px] z-50 rounded-full transition-all duration-300 ${
        scrolled
          ? "bg-[#121215]/80 backdrop-blur-md border border-white/10 shadow-lg shadow-black/40 py-3"
          : "bg-transparent border border-transparent py-5"
      }`}
    >
      <div className="mx-auto px-6 md:px-8 flex items-center justify-between">
        {/* Logo / Wordmark */}
        <a href="#hero" className="flex items-center gap-2 group">
          <span className="font-mono text-sm tracking-[0.18em] text-white font-bold uppercase transition-all duration-300">
            Casper <span className="text-accent-red group-hover:text-white transition-colors duration-300">Trust</span> Layer
          </span>
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-red opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-red" />
          </span>
        </a>

        {/* Desktop Navigation Links — shown at lg where there's room */}
        <nav className="hidden xl:flex items-center gap-7">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-xs uppercase tracking-widest text-[#8E8E93] hover:text-white transition-colors duration-200 whitespace-nowrap"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* CTA Buttons */}
        <div className="flex items-center gap-2.5">
          <a
            href="/app"
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white border border-white/20 rounded-full hover:border-white hover:bg-white hover:text-black transition-all duration-300 whitespace-nowrap"
          >
            Open Console ↗
          </a>
          <a
            href="#developer"
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white bg-accent-red border border-transparent rounded-full hover:bg-white hover:text-black transition-all duration-300 hover:scale-105 active:scale-95 shadow-md shadow-accent-red/20 whitespace-nowrap"
          >
            Install SDK
          </a>
        </div>
      </div>
    </header>
  );
}
