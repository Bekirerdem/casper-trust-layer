import type { Metadata } from "next";
import localFont from "next/font/local";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

const zodiak = localFont({
  src: [
    { path: "../public/fonts/zodiak-regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/zodiak-bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-zodiak",
  display: "swap",
});

const switzer = localFont({
  src: [
    { path: "../public/fonts/switzer-regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/switzer-medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/switzer-semibold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-switzer",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
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
      className={`${zodiak.variable} ${switzer.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-text">
        {children}
      </body>
    </html>
  );
}
