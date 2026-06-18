import { describe, it, expect } from "vitest";
import { readOdraValue } from "../src/odra/read.js";
import type { RpcClient } from "casper-js-sdk";

/** Minimal mock — only the one method readOdraValue calls. */
function makeMockRpc(
  impl: () => Promise<unknown>,
): Pick<RpcClient, "getDictionaryItemByIdentifier"> {
  return { getDictionaryItemByIdentifier: impl } as any;
}

describe("readOdraValue (offline unit)", () => {
  it("returns null when the RPC throws a -32003 QueryFailed error (key absent)", async () => {
    const err = Object.assign(new Error("QueryFailed: key does not exist"), { code: -32003 });
    const rpc = makeMockRpc(() => Promise.reject(err));
    const result = await readOdraValue(rpc as any, "deadbeef", "aabbcc");
    expect(result).toBeNull();
  });

  it("re-throws on a generic transport error (must NOT return null)", async () => {
    const err = new Error("ECONNREFUSED");
    const rpc = makeMockRpc(() => Promise.reject(err));
    await expect(readOdraValue(rpc as any, "deadbeef", "aabbcc")).rejects.toThrow("ECONNREFUSED");
  });
});
