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
    // Real error shape from casper-js-sdk: the -32003 code lives on statusCode /
    // sourceErr.code, NOT on e.code (which is undefined in the actual thrown object).
    const notFound = Object.assign(new Error("Code: -32003, err: Query failed"), {
      statusCode: -32003,
      sourceErr: { code: -32003, message: "Query failed" },
    });
    const rpc = makeMockRpc(() => Promise.reject(notFound));
    const result = await readOdraValue(rpc as any, "deadbeef", "aabbcc");
    expect(result).toBeNull();
  });

  it("re-throws on a generic transport error (must NOT return null)", async () => {
    // No -32003 anywhere — must propagate, not be silently swallowed as null.
    const err = new Error("ECONNREFUSED");
    const rpc = makeMockRpc(() => Promise.reject(err));
    await expect(readOdraValue(rpc as any, "deadbeef", "aabbcc")).rejects.toThrow("ECONNREFUSED");
  });
});
