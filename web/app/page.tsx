import { Hero } from "@/components/sections/Hero";
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
    <main className="bg-bg min-h-screen">
      <Hero />
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
    </main>
  );
}
