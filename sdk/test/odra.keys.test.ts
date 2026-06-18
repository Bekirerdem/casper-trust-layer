import { describe, it, expect } from "vitest";
import { blake2b } from "blakejs";
import { varKey, mapKeyU32 } from "../src/odra/keys.js";

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
// index_bytes for a Var at field index 3 = u32 BIG-endian = 00000003
const expectVar3 = hex(blake2b(Uint8Array.from([0, 0, 0, 3]), undefined, 32));
// Mapping<u32,_> at field index 3, key 0 = idxBE(3) ++ u32LE(0) = 00000003 00000000
const expectMap3Key0 = hex(blake2b(Uint8Array.from([0, 0, 0, 3, 0, 0, 0, 0]), undefined, 32));

describe("odra keys", () => {
  it("derives Var key (u32 big-endian index)", () => {
    expect(varKey(3)).toBe(expectVar3);
  });
  it("derives Mapping<u32> key (idxBE ++ keyLE)", () => {
    expect(mapKeyU32(3, 0)).toBe(expectMap3Key0);
  });
});
