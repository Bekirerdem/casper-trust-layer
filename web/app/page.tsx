import { Hero } from "@/components/sections/Hero";
import { TelemetryTicker } from "@/components/sections/TelemetryTicker";
import { Problem } from "@/components/sections/Problem";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { TrustGating } from "@/components/sections/TrustGating";
import { LiveProof } from "@/components/sections/LiveProof";
import { Developer } from "@/components/sections/Developer";
import { FinalCta } from "@/components/sections/FinalCta";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { Divider } from "@/components/ui/Divider";

export default function Home() {
  return (
    <main className="bg-bg min-h-screen pt-20 relative overflow-hidden">
      {/* Background Grids & Glows */}
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none z-0" />
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-glow-red pointer-events-none z-0" />
      <div className="absolute top-3/4 right-0 w-[500px] h-[500px] bg-glow-red pointer-events-none z-0" />
      
      <div className="relative z-10">
        <Hero />
        <TelemetryTicker />
        <Problem />
        <Divider />
        <HowItWorks />
        <Divider />
        <TrustGating />
        <Divider />
        <LiveProof />
        <Divider />
        <Developer />
        <Divider />
        <FinalCta />
        <SiteFooter />
      </div>
    </main>
  );
}
