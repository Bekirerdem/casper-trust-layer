import { loadSnapshot } from "./snapshot";

test("snapshot has valid shape", () => {
  const s = loadSnapshot();
  expect(s.agents.length).toBeGreaterThan(0);
  for (const a of s.agents) {
    expect(a.scoreBps).toBeGreaterThanOrEqual(0);
    expect(a.scoreBps).toBeLessThanOrEqual(10_000);
  }
  for (const p of s.settlements) {
    expect(p.txHash).toMatch(/^[0-9a-f]{64}$/);
  }
});

test("snapshot network is casper-test", () => {
  const s = loadSnapshot();
  expect(s.network).toBe("casper-test");
});

test("snapshot capturedAt is an ISO date string", () => {
  const s = loadSnapshot();
  expect(new Date(s.capturedAt).getTime()).not.toBeNaN();
});
