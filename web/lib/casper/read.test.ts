import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Reputation } from "casper-trust";

// Mock casper-trust before importing read.ts
vi.mock("casper-trust", () => ({
  createTrustClient: vi.fn(() => ({ cfg: {}, rpc: {} })),
  getReputation: vi.fn(),
  getAgent: vi.fn(),
}));

import { createReadClient, getReputation } from "./read";
import * as sdk from "casper-trust";

const mockGetReputation = vi.mocked(sdk.getReputation);
const mockGetAgent = vi.mocked(sdk.getAgent);

describe("createReadClient", () => {
  it("returns a client object", () => {
    const client = createReadClient();
    expect(client).toBeDefined();
    expect(typeof client).toBe("object");
  });
});

describe("getReputation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("converts bigint scoreBps and jobsCompleted to number", async () => {
    // SDK returns Reputation with bigint fields — this is the REAL SDK shape
    const sdkReputation: Reputation = {
      scoreBps: 9400n,
      jobsCompleted: 3n,
      totalVolume: 500_000n,
      distinctClients: 2,
      grantedOutBps: 200n,
    };
    mockGetReputation.mockResolvedValueOnce(sdkReputation);
    mockGetAgent.mockResolvedValueOnce({
      owner: "account-hash-abc",
      wallet: "account-hash-abc",
      agentUri: "ipfs://test",
      bond: 10_000_000_000n,
      status: "Active",
    });

    const client = createReadClient();
    const result = await getReputation(client, 0);

    expect(result.scoreBps).toBe(9400);
    expect(typeof result.scoreBps).toBe("number");
    expect(result.jobsCompleted).toBe(3);
    expect(typeof result.jobsCompleted).toBe("number");
    expect(result.exists).toBe(true);
    expect(result.agentId).toBe(0);
  });

  it("returns exists=false when agent is null", async () => {
    const sdkReputation: Reputation = {
      scoreBps: 0n,
      jobsCompleted: 0n,
      totalVolume: 0n,
      distinctClients: 0,
      grantedOutBps: 0n,
    };
    mockGetReputation.mockResolvedValueOnce(sdkReputation);
    mockGetAgent.mockResolvedValueOnce(null);

    const client = createReadClient();
    const result = await getReputation(client, 99);

    expect(result.exists).toBe(false);
    expect(result.scoreBps).toBe(0);
    expect(result.jobsCompleted).toBe(0);
  });
});
