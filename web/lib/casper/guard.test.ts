// @vitest-environment node
import { describe, it, expect } from "vitest";
import { GuardError, clientIp, parseAmount, parseId, parsePublicKey, throttle } from "./guard";
import { decodeJob } from "./escrowRead";

const status = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof GuardError ? e.status : "not-a-guard-error";
  }
  return "no-throw";
};

describe("parseAmount", () => {
  it("parses decimals without floating point", () => {
    expect(parseAmount("1", 9, 100)).toBe(BigInt(1_000_000_000));
    expect(parseAmount("0.001", 9, 100)).toBe(BigInt(1_000_000));
    expect(parseAmount("0.1", 9, 100)).toBe(BigInt(100_000_000));
  });

  it("rejects zero, garbage, exponent notation and over-max amounts", () => {
    for (const bad of ["0", "abc", "1e9", "-1", "", "1.0000000001", "101", 1e21]) {
      expect(status(() => parseAmount(bad, 9, 100))).toBe(400);
    }
  });

  it("allows zero only when asked", () => {
    expect(parseAmount("0", 9, 100, { allowZero: true })).toBe(BigInt(0));
  });
});

describe("parseId", () => {
  it("accepts integers and numeric strings within range", () => {
    expect(parseId(7, "id")).toBe(BigInt(7));
    expect(parseId("42", "id", BigInt(64))).toBe(BigInt(42));
  });

  it("rejects negatives, floats, NaN and out-of-range values", () => {
    for (const bad of [-1, 1.5, NaN, "65", "0x10", null, undefined]) {
      expect(status(() => parseId(bad, "id", BigInt(64)))).toBe(400);
    }
  });
});

describe("parsePublicKey", () => {
  it("accepts ed25519 and secp256k1 keys", () => {
    expect(parsePublicKey("01" + "ab".repeat(32)).toHex()).toBe("01" + "ab".repeat(32));
    const secp = "020373f992169219caed5b5796d0aad63b6f4c4970ba93793abaf8e2a7bdd36cac66";
    expect(parsePublicKey(secp).toHex()).toBe(secp);
  });

  it("rejects malformed keys with 400", () => {
    for (const bad of ["", "03" + "ab".repeat(32), "01abc", 12, null]) {
      expect(status(() => parsePublicKey(bad))).toBe(400);
    }
  });
});

describe("throttle", () => {
  it("allows max hits per window, then 429", () => {
    const bucket = `t-${Math.random()}`;
    throttle(bucket, "ip", 2, 60_000);
    throttle(bucket, "ip", 2, 60_000);
    expect(status(() => throttle(bucket, "ip", 2, 60_000))).toBe(429);
    expect(status(() => throttle(bucket, "other-ip", 2, 60_000))).toBe("no-throw");
  });
});

describe("clientIp", () => {
  it("prefers the edge-provided header over the spoofable first hop", () => {
    const req = new Request("https://x", {
      headers: { "x-forwarded-for": "6.6.6.6, 1.2.3.4", "x-vercel-forwarded-for": "1.2.3.4" },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
  });
});

describe("decodeJob", () => {
  it("decodes Job { u32, u32, U256, String, u64, JobState }", () => {
    const hash = Buffer.from("sha256:ab", "utf8");
    const bytes = Buffer.concat([
      Buffer.from([3, 0, 0, 0]), // client_id 3
      Buffer.from([1, 0, 0, 0]), // provider 1
      Buffer.from([2, 0x10, 0x27]), // U256 10000
      Buffer.from([hash.length, 0, 0, 0]),
      hash,
      Buffer.from([0xe8, 0x03, 0, 0, 0, 0, 0, 0]), // deadline 1000
      Buffer.from([1]), // Submitted
    ]);
    expect(decodeJob(Uint8Array.from(bytes))).toEqual({
      clientId: 3,
      provider: 1,
      amount: BigInt(10_000),
      resultHash: "sha256:ab",
      deadlineMs: BigInt(1000),
      state: "Submitted",
    });
  });
});
