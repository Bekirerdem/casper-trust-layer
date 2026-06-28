import type { Metadata } from "next";
import { TrustDashboard } from "@/components/dashboard/TrustDashboard";

export const metadata: Metadata = {
  title: "Trust Console — Casper Trust Layer",
  description:
    "Explore the Casper agent trust network: live on-chain reputation, settlement history, and treasury — wallet-free reads.",
};

export default function AppPage() {
  return <TrustDashboard />;
}
