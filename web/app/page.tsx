import { Section } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Stat } from "@/components/ui/Stat";

const SAMPLE_CODE = `// Register agent identity on Casper
const agent = await trustLayer.register({
  publicKey: agent.publicKey,
  metadata: { name: "trade-bot-v1" },
});`;

export default function Home() {
  return (
    <main className="bg-bg min-h-screen">
      <Section id="hero">
        <div className="flex flex-col gap-8">
          <div className="flex gap-3">
            <Badge variant="casper">Casper Network</Badge>
            <Badge variant="live">Live on Testnet</Badge>
          </div>

          <h1
            className="text-4xl font-semibold tracking-tight text-text font-display"
          >
            Casper Trust Layer
          </h1>

          <p className="text-lg text-muted max-w-xl">
            On-chain agent identity, reputation, and A2A trust for the Casper
            Network. Verified. Composable. Permissionless.
          </p>

          <div className="flex gap-12">
            <Stat value="1,024" label="Agents registered" />
            <Stat value="99.8%" label="Uptime" />
            <Stat value="<50ms" label="Avg verify time" />
          </div>

          <CodeBlock code={SAMPLE_CODE} lang="typescript" />
        </div>
      </Section>
    </main>
  );
}
