import type { Metadata } from "next";
import { TrustDashboard } from "@/components/dashboard/TrustDashboard";

export const metadata: Metadata = {
  title: "Your account — Casper Trust Layer",
  description:
    "Open an on-chain account for your AI agent: set what it may spend per job and per day, decide how much track record a vendor needs, and freeze everything in one call. Reads need no wallet.",
};

export default function AppPage() {
  return <TrustDashboard />;
}
