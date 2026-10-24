import { describe, it, expect } from "vitest";
import { decodeReputation, decodeAgent, decodeJob } from "../src/trust/decode.js";
const bytes = (h: string) => Uint8Array.from(Buffer.from(h, "hex"));

describe("trust decode", () => {
  it("decodes Reputation", () => {
    // jobs=1(u64) volume=1000(U256:02 e803) distinct=2(u32) score=1000 granted=0(U256:00)
    const p = bytes("0100000000000000" + "02e803" + "02000000" + "02e803" + "00");
    expect(decodeReputation(p)).toEqual({
      jobsCompleted: 1n, totalVolume: 1000n, distinctClients: 2, scoreBps: 1000n, grantedOutBps: 0n,
    });
  });
  it("decodes Agent (owner,wallet acct-hash; uri; bond; status=Active)", () => {
    const acct = "00" + "11".repeat(32);
    const p = bytes(acct + acct + "03000000616263" + "0500e40b5402" /*U512 10e9=10000000000*/ + "00");
    const a = decodeAgent(p);
    expect(a.agentUri).toBe("abc");
    expect(a.bond).toBe(10000000000n);
    expect(a.status).toBe("Active");
  });
  it("decodes a v2 Job, including the states after Refunded and submitted_at", () => {
    // client=3 provider=0 amount=1000 result="ab" deadline=5 state=Accepted(4) submitted_at=7
    const p = bytes(
      "03000000" + "00000000" + "02e803" + "020000006162" + "0500000000000000" + "04" + "0700000000000000",
    );
    expect(decodeJob(p)).toEqual({
      clientId: 3, provider: 0, amount: 1000n, resultHash: "ab", deadline: 5n, state: "Accepted", submittedAt: 7n,
    });
  });
  it("rejects an unknown job state", () => {
    const p = bytes("00000000" + "01000000" + "00" + "00000000" + "0000000000000000" + "09" + "0000000000000000");
    expect(() => decodeJob(p)).toThrow(/unknown job state 9/);
  });
});
