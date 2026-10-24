import { describe, it, expect } from "vitest";
import { CASPER_TEST } from "../src/config.js";
import { makeRpcClient } from "../src/rpc/client.js";
import { checkTrust, getReputation, getAgent, getJob, getJobCount } from "../src/trust/index.js";

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
  it("reads a seeded v2 agent and its first job (scripts/seed-v2.mts)", async () => {
    const t = await checkTrust(c, 0, { minScore: 1n });
    expect(t.exists).toBe(true);
    expect(t.status).toBe("Active");
    expect(t.unbonding).toBe(false);
    expect(t.trusted).toBe(true);
    expect(t.jobsCompleted).toBeGreaterThanOrEqual(3n);

    const job = await getJob(c, 0n);
    expect(job).toMatchObject({ clientId: 3, provider: 0, state: "Released" });
    expect(job!.submittedAt).toBeGreaterThan(0n);
    expect(await getJobCount(c)).toBeGreaterThanOrEqual(6n);
  }, 60_000);
});
