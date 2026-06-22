import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Divider } from "@/components/ui/Divider";

export default function Home() {
  return (
    <main className="bg-bg min-h-screen">
      <Hero />
      <Problem />
      <Divider />
      <HowItWorks />
    </main>
  );
}
