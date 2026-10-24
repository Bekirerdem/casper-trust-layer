import { Reader, u32, u64, uN, str, addr, unitEnum } from "../odra/bytesrepr.js";
import { JOB_STATES, type Reputation, type Agent, type Job, type JobState } from "../types.js";

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

/** `Job { u32, u32, U256, String, u64, JobState, u64 }`. */
export function decodeJob(p: Uint8Array): Job {
  const r = new Reader(p);
  const clientId = u32(r);
  const provider = u32(r);
  const amount = uN(r);
  const resultHash = str(r);
  const deadline = u64(r);
  const state = unitEnum(r, [...JOB_STATES]) as JobState | undefined;
  if (!state) throw new Error(`unknown job state ${p[r.o - 1]}`);
  const submittedAt = u64(r);
  return { clientId, provider, amount, resultHash, deadline, state, submittedAt };
}
