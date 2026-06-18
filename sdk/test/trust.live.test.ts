import { describe, it, expect } from "vitest";
import { CASPER_TEST } from "../src/config.js";
import { makeRpcClient } from "../src/rpc/client.js";
import { checkTrust, getReputation, getAgent } from "../src/trust/index.js";

const live = process.env.CASPER_LIVE === "1";
describe.skipIf(!live)("trust (live)", () => {
  const c = { rpc: makeRpcClient(CASPER_TEST), cfg: CASPER_TEST };
  it("returns zero/not-exists defaults for an unregistered agent (no wallet, no gas)", async () => {
    const t = await checkTrust(c, 999999);
    expect(t.exists).toBe(false);
    expect(t.trusted).toBe(false);
    expect(t.score).toBe(0n);
    expect(await getAgent(c, 999999)).toBeNull();
    expect((await getReputation(c, 999999)).jobsCompleted).toBe(0n);
  });
  // After Task 6 registers a real agent, add: it("reads the real agent's score", ...) asserting exists + status Active.
});
