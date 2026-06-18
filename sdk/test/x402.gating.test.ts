import { describe, it, expect, vi } from "vitest";
import { gateByTrust, TrustGateError } from "../src/x402/index.js";

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
