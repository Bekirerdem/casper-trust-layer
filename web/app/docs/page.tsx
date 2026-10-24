import type { Metadata } from "next";
import Link from "next/link";
import { CONTRACTS } from "@/lib/casper/contracts";

export const metadata: Metadata = {
  title: "Docs — Casper Trust Layer",
  description:
    "Concepts, build guide and verification path for the settled-payment trust layer on Casper.",
};

const ROLES: Record<string, string> = {
  AgentVaults: "a vault per customer · their caps, their freeze",
  IdentityRegistry: "ERC-8004 identity · CSPR bond · 7-day unbonding · slash",
  ReputationEngine: "score derived from settlements · same-owner earns 0",
  Escrow: "fund → accept → deliver → settle · 2% fee retained",
  AgentTreasury: "spend caps · counterparty gate · owner's brake",
  "Cep18 (AGT)": "demo payment token",
};

const PROOFS = [
  { what: "Unproven payee refused before the balance is checked", tx: "60d9bef5bcbb64b4993b329f46e2d3dc5ea8e7cad33899f3b3d4b8824baf0d3e" },
  { what: "Proven payee clears the same gate and settles", tx: "f1dc429a22d976b575d70cc52828e836bd7f65b4dfd1e6026a95f816968e9ca5" },
  { what: "Over the per-task cap — refused", tx: "7fa2aff00477b2fa7ca473d57004d81cbd17ab6745558549218b52e0e2ef1205" },
  { what: "Owner pulls the brake — pause()", tx: "e1d283b9595080a559a66f061f512480a95f0b5fd6c98a1185171c41a6a49d6b" },
  { what: "The same payment now reverts — Paused", tx: "95f94f2f5731649d17db139159f5933a9a8b6cec6839b3b4c91e73514350b2c8" },
  { what: "A job settled across owners — the provider's score moves", tx: "1fa8296f1ffb538eb9969dcba74a046a69f15e36bf0173e03efd11afd92c25d8" },
  { what: "x402 payment refused below the bar, settled above it", tx: "4b2ab2c28df59792903ab17fe16f6c9a74c477fc204e46941b739d30f1296e25" },
];

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-line bg-subtle p-4 font-mono text-xs leading-relaxed text-muted">
      <code>{children}</code>
    </pre>
  );
}

function Section({ id, label, title, children }: { id: string; label: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 flex flex-col gap-5 border-t border-line pt-12">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-red">{label}</span>
        <h2 className="font-sans text-3xl md:text-4xl font-black tracking-tight text-ink">{title}</h2>
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
          <h1 className="font-sans text-4xl md:text-5xl font-black tracking-tight text-ink">Documentation</h1>
          <p className="font-sans text-lg text-muted max-w-[62ch] leading-relaxed">
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
                className="rounded-full border border-line bg-surface px-4 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink transition-all duration-300 hover:border-accent-red/40 hover:bg-accent-red/5"
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
                  d: "What the agent may spend: a per-task ceiling, a ceiling over any rolling 24 hours, and the unlocked balance. Enforced inside AgentTreasury.pay() before a token moves.",
                },
                {
                  t: "The counterparty rule",
                  d: "Who it may pay: anyone whitelisted, or anyone whose earned score clears the owner's bar. The owner changes that bar with one call; every payment after it obeys the new rule.",
                },
                {
                  t: "Track record",
                  d: "Where a score comes from: settled escrow jobs, nothing else. No LLM jury, no validator committee, no self-reports. A score moves only when a real CEP-18 payment settles between two different owners and the paying client approves it.",
                },
                {
                  t: "The brake",
                  d: "The undo: one owner-only call halts every payment and new reservation. Funds stay where they are — pausing moves nothing, it only stops new outflow.",
                },
              ].map((c) => (
                <div key={c.t} className="rounded-xl border border-line bg-surface p-5">
                  <h3 className="font-mono text-sm font-bold text-ink mb-2">{c.t}</h3>
                  <p className="font-sans text-sm text-muted leading-relaxed">{c.d}</p>
                </div>
              ))}
            </div>

            <p className="font-sans text-sm text-muted leading-relaxed max-w-[70ch]">
              The pieces compose in one direction: an agent earns a track record by delivering paid
              work, and that record is what lets someone else&apos;s treasury pay it without the owner
              ever approving it by hand. Trust is the thing that removes manual whitelisting.
            </p>
          </Section>

          {/* ── BUILD ────────────────────────────────────────────────── */}
          <Section id="build" label="02 / Build" title="One install, one call">
            <p className="font-sans text-sm text-muted leading-relaxed max-w-[70ch]">
              Reads need no wallet, no key and no gas — the SDK decodes contract storage directly over
              RPC. That is deliberate: a trust layer nobody can query without signing up is not a trust
              layer.
            </p>

            <Code>{`npm install casper-trust`}</Code>

            <h3 className="font-mono text-xs uppercase tracking-widest text-ink mt-2">Read a counterparty</h3>
            <Code>{`import { createTrustClient, checkTrust } from "casper-trust";

const result = await checkTrust(createTrustClient(), 0, { minScore: 100n });
// { agentId: 0, exists: true, trusted: true, score: 790n, jobsCompleted: 3n,
//   status: 'Active', bond: 10000000000n, unbonding: false }`}</Code>

            <h3 className="font-mono text-xs uppercase tracking-widest text-ink mt-2">Gate a payment</h3>
            <p className="font-sans text-sm text-muted leading-relaxed max-w-[70ch]">
              <code className="font-mono text-ink">pay()</code> checks the counterparty&apos;s on-chain
              score before spending anything. Below the bar it throws{" "}
              <code className="font-mono text-ink">TrustGateError</code> and nothing leaves the
              wallet; above it, a real x402 handshake settles on-chain.
            </p>
            <Code>{`import { createTrustClient, pay } from "casper-trust";
import { toClientCasperSigner } from "@make-software/casper-x402";

const client = { ...createTrustClient(), signer: toClientCasperSigner(account) };

await pay(client, {
  url: "https://api.example.com/premium",
  providerAgentId: 0,
  minScore: 100n,          // require 100 bps of earned trust
  maxAmount: 10_000_000n,  // never sign more than 0.01 AGT, whatever the 402 asks
});`}</Code>

            <h3 className="font-mono text-xs uppercase tracking-widest text-ink mt-2">Give it to your agent</h3>
            <p className="font-sans text-sm text-muted leading-relaxed max-w-[70ch]">
              The MCP server exposes the same reads as native tools, so Claude or Cursor can ask
              &quot;should I pay this agent?&quot; against live chain state.
            </p>
            <Code>{`check_trust · get_reputation · get_agent`}</Code>

            <h3 className="font-mono text-xs uppercase tracking-widest text-ink mt-2">Run your own treasury</h3>
            <p className="font-sans text-sm text-muted leading-relaxed max-w-[70ch]">
              The demo treasury on this site is shared. To get your own envelope — your caps, your
              bar, your brake — deploy the contract from the repo. Odra has no upgrade path, so each
              treasury is its own install.
            </p>
            <Code>{`cd contracts
cargo odra test                          # 100 OdraVM tests
cargo odra build                         # needs wabt + binaryen >= 130
cargo run --bin contracts_cli -- deploy  # see contracts/.env.example`}</Code>
          </Section>

          {/* ── VERIFY ───────────────────────────────────────────────── */}
          <Section id="verify" label="03 / Verify" title="Don't trust this page">
            <p className="font-sans text-sm text-muted leading-relaxed max-w-[70ch]">
              Every number on this site is decoded from contract storage on request. Start with a
              single command — no wallet, no key, no install:
            </p>
            <Code>{`curl https://casper-trust-layer.vercel.app/api/trust/0
# {"agentId":0,"scoreBps":790,"jobsCompleted":3,"exists":true}

curl https://casper-trust-layer.vercel.app/api/treasury
# {"perTaskLimit":"100000000000","dailyLimit":"500000000000",
#  "minReputation":1,"locked":"0","paused":false, ... }`}</Code>

            <h3 className="font-mono text-xs uppercase tracking-widest text-ink mt-2">Live contracts</h3>
            <div className="flex flex-col gap-2">
              {CONTRACTS.map((c) => (
                <a
                  key={c.pkg}
                  href={`https://testnet.cspr.live/contract-package/${c.pkg}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface px-4 py-3 font-mono text-xs transition-colors hover:border-ink/20 hover:bg-subtle"
                >
                  <span className="text-ink">{c.name}</span>
                  <span className="text-muted normal-case">{ROLES[c.name]}</span>
                  <span className="text-muted">{c.pkg.slice(0, 8)}… <span className="text-accent-red">↗</span></span>
                </a>
              ))}
            </div>

            <h3 className="font-mono text-xs uppercase tracking-widest text-ink mt-2">
              The rules, proven on-chain
            </h3>
            <div className="flex flex-col gap-2">
              {PROOFS.map((p) => (
                <a
                  key={p.tx}
                  href={`https://testnet.cspr.live/transaction/${p.tx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface px-4 py-3 font-mono text-xs transition-colors hover:border-ink/20 hover:bg-subtle"
                >
                  <span className="text-muted normal-case">{p.what}</span>
                  <span className="text-muted">{p.tx.slice(0, 10)}… <span className="text-accent-red">↗</span></span>
                </a>
              ))}
            </div>

            <p className="font-sans text-sm text-muted leading-relaxed max-w-[70ch] mt-2">
              A rejected payment still costs gas and still lands on the chain. That is what makes a
              refusal evidence rather than a claim — you can open any of the reverts above and read
              it yourself.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/app"
                className="inline-flex items-center gap-2 rounded-full bg-accent-red px-6 py-2.5 font-mono text-xs font-semibold uppercase tracking-widest text-bg transition-all duration-300 hover:bg-ink hover:text-bg"
              >
                Open the console →
              </Link>
              <a
                href="https://github.com/Bekirerdem/casper-trust-layer/blob/main/JUDGES.md"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-6 py-2.5 font-mono text-xs uppercase tracking-widest text-ink transition-all duration-300 hover:border-ink/30"
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
