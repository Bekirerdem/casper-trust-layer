import type { TrustSnapshot, AgentSnapshot, SettlementProof } from "@/lib/casper/types";
import raw from "./snapshot.json";

function assertAgentSnapshot(v: unknown): asserts v is AgentSnapshot {
  if (
    typeof v !== "object" ||
    v === null ||
    typeof (v as AgentSnapshot).agentId !== "number" ||
    typeof (v as AgentSnapshot).scoreBps !== "number" ||
    typeof (v as AgentSnapshot).jobsCompleted !== "number" ||
    typeof (v as AgentSnapshot).exists !== "boolean"
  ) {
    throw new Error("snapshot.json: invalid AgentSnapshot shape");
  }
}

function assertSettlementProof(v: unknown): asserts v is SettlementProof {
  if (
    typeof v !== "object" ||
    v === null ||
    typeof (v as SettlementProof).txHash !== "string" ||
    !/^[0-9a-f]{64}$/.test((v as SettlementProof).txHash) ||
    typeof (v as SettlementProof).from !== "number" ||
    typeof (v as SettlementProof).to !== "number" ||
    typeof (v as SettlementProof).amount !== "string" ||
    typeof (v as SettlementProof).scoreBefore !== "number" ||
    typeof (v as SettlementProof).scoreAfter !== "number"
  ) {
    throw new Error("snapshot.json: invalid SettlementProof shape");
  }
}

export function assertTrustSnapshot(v: unknown): asserts v is TrustSnapshot {
  if (
    typeof v !== "object" ||
    v === null ||
    typeof (v as TrustSnapshot).capturedAt !== "string" ||
    (v as TrustSnapshot).network !== "casper-test" ||
    !Array.isArray((v as TrustSnapshot).agents) ||
    !Array.isArray((v as TrustSnapshot).settlements)
  ) {
    throw new Error("snapshot.json: invalid TrustSnapshot shape");
  }
  for (const a of (v as TrustSnapshot).agents) assertAgentSnapshot(a);
  for (const p of (v as TrustSnapshot).settlements) assertSettlementProof(p);
}

/** Load and validate the build-time testnet snapshot. */
export function loadSnapshot(): TrustSnapshot {
  assertTrustSnapshot(raw);
  return raw;
}
