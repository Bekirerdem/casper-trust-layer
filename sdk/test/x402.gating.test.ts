import { describe, it, expect, vi } from "vitest";
import { capRequirements, gateByTrust, TrustGateError } from "../src/x402/index.js";
import { isCsprCloud } from "../src/rpc/client.js";

describe("x402 spend ceiling", () => {
  const reqs = [{ amount: "1000" }, { amount: "5000" }, { amount: "not-a-number" }];

  it("keeps only options at or under maxAmount", () => {
    expect(capRequirements(reqs, 1000n)).toEqual([{ amount: "1000" }]);
    expect(capRequirements(reqs, 10_000n)).toEqual([{ amount: "1000" }, { amount: "5000" }]);
  });

  it("leaves nothing to sign when every option is over the ceiling", () => {
    expect(capRequirements(reqs, 999n)).toEqual([]);
  });
});

describe("cspr.cloud token scoping", () => {
  it("only cspr.cloud hosts get the token", () => {
    expect(isCsprCloud("https://node.testnet.cspr.cloud/rpc")).toBe(true);
    expect(isCsprCloud("https://node.testnet.casper.network/rpc")).toBe(false);
    expect(isCsprCloud("https://cspr.cloud.evil.example/rpc")).toBe(false);
    expect(isCsprCloud("http://node.cspr.cloud/rpc")).toBe(false);
    expect(isCsprCloud("not a url")).toBe(false);
  });
});

describe("x402 trust gating", () => {
  it("blocks a below-threshold provider before paying", async () => {
    const check = vi.fn(async () => ({ trusted: false, score: 10n } as any));
    await expect(gateByTrust(check as any, 7, 5000n)).rejects.toBeInstanceOf(TrustGateError);
    expect(check).toHaveBeenCalledWith(7, { minScore: 5000n });
  });

  it("allows an at/above-threshold provider", async () => {
    const check = vi.fn(async () => ({ trusted: true, score: 6000n } as any));
    await expect(gateByTrust(check as any, 7, 5000n)).resolves.toBeUndefined();
  });

  it("no gating when minScore is undefined", async () => {
    const check = vi.fn();
    await expect(gateByTrust(check as any, undefined, undefined)).resolves.toBeUndefined();
    expect(check).not.toHaveBeenCalled();
  });
});
