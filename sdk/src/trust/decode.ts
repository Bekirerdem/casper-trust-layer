import { Reader, u32, u64, uN, str, addr, unitEnum } from "../odra/bytesrepr.js";
import type { Reputation, Agent } from "../types.js";

export function decodeReputation(p: Uint8Array): Reputation {
  const r = new Reader(p);
  return {
    jobsCompleted: u64(r),
    totalVolume: uN(r),
    distinctClients: u32(r),
    scoreBps: uN(r),
    grantedOutBps: uN(r),
  };
}

export function decodeAgent(p: Uint8Array): Agent {
  const r = new Reader(p);
  return {
    owner: addr(r),
    wallet: addr(r),
    agentUri: str(r),
    bond: uN(r),
    status: unitEnum(r, ["Active", "Slashed", "Withdrawn"]) as Agent["status"],
  };
}
