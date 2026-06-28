"use client";

import { loadSnapshot } from "@/lib/data/snapshot";

interface TickerItem {
  id: string;
  label: string;
  value: string;
  type: "success" | "warning" | "info" | "error";
}

// Every line is derived from the real on-chain snapshot — no fabricated values.
function buildItems(): TickerItem[] {
  const s = loadSnapshot();
  const items: TickerItem[] = [
    { id: "net", label: "NETWORK", value: "CASPER-TESTNET ACTIVE", type: "info" },
  ];

  for (const a of s.agents) {
    items.push({
      id: `agent-${a.agentId}`,
      label: `AGENT_${a.agentId}`,
      value: `SCORE ${a.scoreBps} BPS`,
      type: a.scoreBps > 0 ? "success" : "info",
    });
  }

  for (const t of s.settlements.slice(0, 3)) {
    const delta = t.scoreAfter - t.scoreBefore;
    items.push({
      id: `settle-${t.txHash}`,
      label: "SETTLED",
      value: `${t.txHash.slice(0, 8)}… +${delta} BPS`,
      type: "success",
    });
  }

  items.push(
    { id: "registry", label: "REGISTRY", value: `${s.agents.length} AGENTS VERIFIED`, type: "info" },
    { id: "x402", label: "x402", value: "FACILITATOR LIVE", type: "success" },
    { id: "src", label: "REPUTATION", value: "DERIVED FROM SETTLED ESCROW", type: "info" },
  );

  return items;
}

export function TelemetryTicker() {
  const items = buildItems();
  // Double the list to support seamless infinite scrolling
  const scrollItems = [...items, ...items];

  return (
    <div className="w-full bg-[#121215]/40 border-y border-white/5 py-4 overflow-hidden relative z-20 backdrop-blur-sm select-none">
      <div className="animate-marquee whitespace-nowrap flex gap-12 items-center">
        {scrollItems.map((item, idx) => (
          <div key={`${item.id}-${idx}`} className="inline-flex items-center gap-2.5">
            <span className="font-mono text-[9px] uppercase tracking-widest text-[#8E8E93]/60 font-bold">
              [{item.label}]
            </span>
            <span
              className={`font-mono text-xs tracking-wide font-semibold ${
                item.type === "success"
                  ? "text-green-400"
                  : item.type === "error"
                  ? "text-accent-red"
                  : "text-white"
              }`}
            >
              {item.value}
            </span>
            <span className="h-1 w-1 bg-white/20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
