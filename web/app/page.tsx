import { Hero } from "@/components/sections/Hero";
import { ThreeRules } from "@/components/sections/ThreeRules";
import { LiveProof } from "@/components/sections/LiveProof";
import { Developer } from "@/components/sections/Developer";
import { FinalCta } from "@/components/sections/FinalCta";
import { SiteFooter } from "@/components/sections/SiteFooter";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-bg pt-24">
      {/* Atmosphere: one grid, one glow behind the hero. Anything more competes
          with the live card, which is the only thing that should pull the eye. */}
      <div className="pointer-events-none absolute inset-0 z-0 bg-grid opacity-[0.18]" />
      <div className="pointer-events-none absolute -top-40 right-0 z-0 h-[620px] w-[620px] bg-glow-red opacity-70" />

      <div className="relative z-10">
        <Hero />
        <ThreeRules />
        <LiveProof />
        <Developer />
        <FinalCta />
        <SiteFooter />
      </div>
    </main>
  );
}
