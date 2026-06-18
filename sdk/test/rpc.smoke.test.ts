import { describe, it, expect } from "vitest";
import { CASPER_TEST } from "../src/config.js";
import { makeRpcClient } from "../src/rpc/client.js";

const live = process.env.CASPER_LIVE === "1";
describe.skipIf(!live)("rpc smoke", () => {
  it("fetches the latest state root hash from testnet", async () => {
    const rpc = makeRpcClient(CASPER_TEST);
    const res = await rpc.getStateRootHashLatest();
    expect(res.stateRootHash.toHex()).toMatch(/^[0-9a-f]{64}$/);
  });
});
