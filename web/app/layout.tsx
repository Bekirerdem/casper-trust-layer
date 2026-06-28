import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/sections/Navbar";
import { SmoothScroll } from "@/components/motion/SmoothScroll";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://web-five-psi-7iqrhfurdh.vercel.app";
const OG_DESCRIPTION =
  "Escrow-derived reputation and trust-gated x402 payments for autonomous AI agents on Casper. Reputation is earned from real on-chain settlements, never self-reported.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Casper Trust Layer — on-chain agent reputation & trust-gated x402",
  description: OG_DESCRIPTION,
  keywords: [
    "Casper",
    "AI agents",
    "agent reputation",
    "ERC-8004",
    "x402",
    "escrow",
    "on-chain trust",
    "A2A",
  ],
  openGraph: {
    title: "Casper Trust Layer",
    description: OG_DESCRIPTION,
    url: SITE_URL,
    siteName: "Casper Trust Layer",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Casper Trust Layer — trust, settled on-chain",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Casper Trust Layer",
    description: OG_DESCRIPTION,
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text">
        {/* Global Cinematic Film Grain Overlay */}
        <div className="fixed inset-0 pointer-events-none z-50 film-grain opacity-70 mix-blend-overlay" />
        <Navbar />
        <SmoothScroll>
          {children}
        </SmoothScroll>
      </body>
    </html>
  );
}
