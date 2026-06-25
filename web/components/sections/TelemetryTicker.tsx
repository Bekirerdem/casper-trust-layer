"use client";

import { useState } from "react";

interface TickerItem {
  id: string;
  label: string;
  value: string;
  type: "success" | "warning" | "info" | "error";
}

export function TelemetryTicker() {
  const [items] = useState<TickerItem[]>(() => [
    { id: "1", label: "AGENT_0", value: "SETTLED (+5 BPS)", type: "success" },
    { id: "2", label: "NETWORK", value: "CASPER-TESTNET ACTIVE", type: "info" },
    { id: "3", label: "ESCROW_BLOCK", value: "0xe81a...f7b3 SECURED", type: "success" },
    { id: "4", label: "AGENT_1", value: "GATE CHECK PASSED", type: "success" },
    { id: "5", label: "x402_STATE", value: "ESCROW CONTRACT DEPLOYED", type: "info" },
    { id: "6", label: "SYSTEM", value: "TELEMETRY SYNCED", type: "success" },
    { id: "7", label: "AGENT_2", value: "SCORE 9450 BPS (STABLE)", type: "info" },
    { id: "8", label: "DEPLOY_STATUS", value: "BLOCK_HEIGHT 4091802", type: "info" },
    { id: "9", label: "GATE_ERROR", value: "AGENT_4 BLOCKED (SCORE 88 BPS)", type: "error" },
  ]);

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
