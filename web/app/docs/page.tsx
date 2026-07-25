import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Docs — Casper Trust Layer",
  description:
    "Concepts, build guide and verification path for the settled-payment trust layer on Casper.",
};

const TREASURY = "95a5cde87caeeee469f6708b4cdbb8ee6b74bf9a50bab429287cc1400ef32f1a";
const CONTRACTS = [
  { name: "IdentityRegistry", pkg: "3a51cc5f4c524f806b3b8899039030bbad141005f81ab99895615d8f050c7adc", role: "ERC-8004 identity · CSPR bond · slash" },
  { name: "Escrow", pkg: "fe6b0ddb307549cc9101659abcfaf114e37a8d99461c0632cbce582ebdc4902c", role: "fund → deliver → settle · 2% fee locked" },
  { name: "ReputationEngine", pkg: "d73fb11144c07ec05071cf986ad65b407f2da91bd871b0c10f67a974832ee7eb", role: "score derived from settlements" },
  { name: "AgentTreasury (v2)", pkg: TREASURY, role: "spend caps · counterparty gate · owner's brake" },
  { name: "Cep18 (AGT)", pkg: "f962076e6c2ba423aaade9f75935ff37ef4aa4cde6077bac9a259af141c3d5c6", role: "demo payment token" },
];

const PROOFS = [
  { what: "Unproven payee refused before the balance is checked", tx: "19ddb53be543487fe8d6e25eb8278231e59ec90ee0cd00d550294cd77d8c4d13" },
  { what: "Proven payee clears the same gate and settles", tx: "64783cce031a0516f0acf9658b4685fd3396c6fd66ba481413ebd88078562374" },
  { what: "Owner pulls the brake — pause()", tx: "d9e87d8a0bfb1dc4d5580b8e40917bfce82d2c95790531e38fe56afaad2003c7" },
  { what: "The same payment now reverts — Paused", tx: "c96cf67dabaeb2eb3462278fc2ccc60cd6a14aa604be0dc2775bccf108ffdff8" },
  { what: "Reputation moved by a browser visitor's own wallet", tx: "04cea776e694eb6aa33ec117c9572a9574979999e62340122b159f976a3490ce" },
  { what: "x402 payment refused below the bar, settled above it", tx: "b4a4635fd7611396c152d904c402ef9c6fcaa876c83fbf8b1429e1d9fb0225e3" },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/50 p-4 font-mono text-xs leading-relaxed text-[#C7CACE]">
      <code>{children}</code>
    </pre>
  );
}

function Section({ id, label, title, children }: { id: string; label: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 flex flex-col gap-5 border-t border-white/10 pt-12">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-red">{label}</span>
        <h2 className="font-sans text-3xl md:text-4xl font-black tracking-tight text-white">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />

      {/* Top padding clears the floating navbar, which stays visible here. */}
      <div className="relative mx-auto max-w-[1100px] px-6 md:px-10 pt-32 pb-16">
        {/* Header */}
        <header className="flex flex-col gap-4 pb-10">
          <h1 className="font-sans text-4xl md:text-5xl font-black tracking-tight text-white">Documentation</h1>
          <p className="font-sans text-lg text-[#8E8E93] max-w-[62ch] leading-relaxed">
            An owner hands an AI agent real money to spend. The contract — not the model&apos;s good
            behaviour — decides how much, to whom, and whether at all.
          </p>
          <nav className="flex flex-wrap gap-3 pt-2">
            {[
              { href: "#concepts", label: "Concepts" },
              { href: "#build", label: "Build" },
              { href: "#verify", label: "Verify" },
            ].map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-white transition-all duration-300 hover:border-accent-red/40 hover:bg-accent-red/5"
              >
                {l.label}
              </a>
            ))}
          </nav>
        </header>

        <div className="flex flex-col gap-14">
          {/* ── CONCEPTS ─────────────────────────────────────────────── */}
          <Section id="concepts" label="01 / Concepts" title="Four things, and how they fit">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  t: "The envelope",
                  d: "What the agent may spend: a per-task ceiling, a UTC daily ceiling, and the unlocked balance. Accounted per task id, enforced inside AgentTreasury.pay() before a token moves.",
                },
                {
                  t: "The counterparty rule",
                  d: "Who it may pay: anyone whitelisted, or anyone whose earned score clears the owner's bar. The owner changes that bar with one call; every payment after it obeys the new rule.",
                },
                {
                  t: "Track record",
                  d: "Where a score comes from: settled escrow jobs, nothing else. No LLM jury, no validator committee, no self-reports. A score moves only when a real CEP-18 payment settles and the paying client approves it.",
                },
                {
                  t: "The brake",
                  d: "The undo: one owner-only call halts every payment and new reservation. Funds stay where they are — pausing moves nothing, it only stops new outflow.",
                },
              ].map((c) => (
                <div key={c.t} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                  <h3 className="font-mono text-sm font-bold text-white mb-2">{c.t}</h3>
                  <p className="font-sans text-sm text-[#8E8E93] leading-relaxed">{c.d}</p>
                </div>
              ))}
            </div>

            <p className="font-sans text-sm text-[#8E8E93] leading-relaxed max-w-[70ch]">
              The pieces compose in one direction: an agent earns a track record by delivering paid
              work, and that record is what lets someone else&apos;s treasury pay it without the owner
              ever approving it by hand. Trust is the thing that removes manual whitelisting.
            </p>
          </Section>

          {/* ── BUILD ────────────────────────────────────────────────── */}
          <Section id="build" label="02 / Build" title="One install, one call">
            <p className="font-sans text-sm text-[#8E8E93] leading-relaxed max-w-[70ch]">
              Reads need no wallet, no key and no gas — the SDK decodes contract storage directly over
              RPC. That is deliberate: a trust layer nobody can query without signing up is not a trust
              layer.
            </p>

            <Code>{`npm install casper-trust`}</Code>

            <h3 className="font-mono text-xs uppercase tracking-widest text-white mt-2">Read a counterparty</h3>
            <Code>{`import { createTrustClient, checkTrust } from "casper-trust";

const result = await checkTrust(createTrustClient(), 0, { minScore: 100n });
// { agentId: 0, exists: true, trusted: true, score: 508n,
//   jobsCompleted: 7n, status: 'Active', bond: 10000000000n }`}</Code>

            <h3 className="font-mono text-xs uppercase tracking-widest text-white mt-2">Gate a payment</h3>
            <p className="font-sans text-sm text-[#8E8E93] leading-relaxed max-w-[70ch]">
              <code className="font-mono text-white">pay()</code> checks the counterparty&apos;s on-chain
              score before spending anything. Below the bar it throws{" "}
              <code className="font-mono text-white">TrustGateError</code> and nothing leaves the
              wallet; above it, a real x402 handshake settles on-chain.
            </p>
            <Code>{`import { createTrustClient, pay } from "casper-trust";
import { toClientCasperSigner } from "@make-software/casper-x402";

const client = { ...createTrustClient(), signer: toClientCasperSigner(account) };

await pay(client, {
  url: "https://api.example.com/premium",
  providerAgentId: 0,
  minScore: 5000n,   // require 50% earned trust
});`}</Code>

            <h3 className="font-mono text-xs uppercase tracking-widest text-white mt-2">Give it to your agent</h3>
            <p className="font-sans text-sm text-[#8E8E93] leading-relaxed max-w-[70ch]">
              The MCP server exposes the same reads as native tools, so Claude or Cursor can ask
              &quot;should I pay this agent?&quot; against live chain state.
            </p>
            <Code>{`check_trust · get_reputation · get_agent`}</Code>

            <h3 className="font-mono text-xs uppercase tracking-widest text-white mt-2">Run your own treasury</h3>
            <p className="font-sans text-sm text-[#8E8E93] leading-relaxed max-w-[70ch]">
              The demo treasury on this site is shared. To get your own envelope — your caps, your
              bar, your brake — deploy the contract from the repo. Odra has no upgrade path, so each
              treasury is its own install.
            </p>
            <Code>{`cd contracts
cargo odra test                          # 52 OdraVM tests
cargo odra build                         # needs wabt + binaryen >= 130
cargo run --bin contracts_cli -- deploy  # see contracts/.env.example`}</Code>
          </Section>

          {/* ── VERIFY ───────────────────────────────────────────────── */}
          <Section id="verify" label="03 / Verify" title="Don't trust this page">
            <p className="font-sans text-sm text-[#8E8E93] leading-relaxed max-w-[70ch]">
              Every number on this site is decoded from contract storage on request. Start with a
              single command — no wallet, no key, no install:
            </p>
            <Code>{`curl https://casper-trust-layer.vercel.app/api/trust/0
# {"agentId":0,"scoreBps":508,"jobsCompleted":7,"exists":true}

curl https://casper-trust-layer.vercel.app/api/treasury
# {"perTaskLimit":"100000000000","dailyLimit":"500000000000",
#  "minReputation":1,"locked":"0","paused":false, ... }`}</Code>

            <h3 className="font-mono text-xs uppercase tracking-widest text-white mt-2">Live contracts</h3>
            <div className="flex flex-col gap-2">
              {CONTRACTS.map((c) => (
                <a
                  key={c.pkg}
                  href={`https://testnet.cspr.live/contract-package/${c.pkg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 font-mono text-xs transition-colors hover:border-white/15 hover:bg-white/5"
                >
                  <span className="text-white">{c.name}</span>
                  <span className="text-[#8E8E93] normal-case">{c.role}</span>
                  <span className="text-[#8E8E93]">{c.pkg.slice(0, 8)}… <span className="text-accent-red">↗</span></span>
                </a>
              ))}
            </div>

            <h3 className="font-mono text-xs uppercase tracking-widest text-white mt-2">
              The rules, proven on-chain
            </h3>
            <div className="flex flex-col gap-2">
              {PROOFS.map((p) => (
                <a
                  key={p.tx}
                  href={`https://testnet.cspr.live/transaction/${p.tx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-3 font-mono text-xs transition-colors hover:border-white/15 hover:bg-white/5"
                >
                  <span className="text-[#C7CACE] normal-case">{p.what}</span>
                  <span className="text-[#8E8E93]">{p.tx.slice(0, 10)}… <span className="text-accent-red">↗</span></span>
                </a>
              ))}
            </div>

            <p className="font-sans text-sm text-[#8E8E93] leading-relaxed max-w-[70ch] mt-2">
              A rejected payment still costs gas and still lands on the chain. That is what makes a
              refusal evidence rather than a claim — you can open any of the reverts above and read
              it yourself.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/app"
                className="inline-flex items-center gap-2 rounded-full bg-accent-red px-6 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-white transition-all duration-300 hover:bg-white hover:text-black"
              >
                Open the console →
              </Link>
              <a
                href="https://github.com/Bekirerdem/casper-trust-layer/blob/main/JUDGES.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-2.5 font-mono text-xs uppercase tracking-widest text-white transition-all duration-300 hover:border-white/40"
              >
                Full verification path ↗
              </a>
            </div>
          </Section>
        </div>
      </div>
    </main>
  );
}
