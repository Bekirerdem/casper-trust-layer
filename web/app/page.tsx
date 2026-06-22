import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { TrustGating } from "@/components/sections/TrustGating";
import { LiveProof } from "@/components/sections/LiveProof";
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
    </main>
  );
}
