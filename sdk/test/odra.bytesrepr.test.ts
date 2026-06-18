import { describe, it, expect } from "vitest";
import { Reader, u32, u64, uN, str, addr, option, unitEnum } from "../src/odra/bytesrepr.js";
const bytes = (h: string) => Uint8Array.from(Buffer.from(h, "hex"));

describe("bytesrepr", () => {
  it("u32 little-endian", () => { expect(u32(new Reader(bytes("05000000")))).toBe(5); });
  it("u64 -> bigint", () => { expect(u64(new Reader(bytes("0100000000000000")))).toBe(1n); });
  it("U256: len-prefixed LE magnitude (1000 = 0x03E8)", () => {
    expect(uN(new Reader(bytes("02e803")))).toBe(1000n);   // len=2, bytes E8 03
  });
  it("U256 zero is a single 00 length byte", () => { expect(uN(new Reader(bytes("00")))).toBe(0n); });
  it("String", () => { expect(str(new Reader(bytes("03000000616263")))).toBe("abc"); }); // len 3 "abc"
  it("Address account-hash", () => {
    const h = "00" + "11".repeat(32);
    expect(addr(new Reader(bytes(h)))).toBe("account-hash-" + "11".repeat(32));
  });
  it("Option Some/None", () => {
    expect(option(new Reader(bytes("00")), u32)).toBeNull();
    expect(option(new Reader(bytes("0105000000")), u32)).toBe(5);
  });
  it("unit enum tag", () => { expect(unitEnum(new Reader(bytes("01")), ["A","B","C"])).toBe("B"); });
  it("sequential reads advance the offset", () => {
    const r = new Reader(bytes("05000000" + "0100000000000000"));
    expect(u32(r)).toBe(5); expect(u64(r)).toBe(1n);
  });
});
