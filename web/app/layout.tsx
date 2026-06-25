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

export const metadata: Metadata = {
  title: "Casper Trust Layer",
  description:
    "On-chain agent identity, reputation, and A2A trust for the Casper Network.",
  openGraph: {
    title: "Casper Trust Layer",
    description:
      "On-chain agent identity, reputation, and A2A trust for the Casper Network.",
    type: "website",
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
