import { describe, it, expect } from "vitest";
import { CASPER_TEST } from "casper-trust";
import { CONTRACTS } from "./contracts";

describe("CONTRACTS", () => {
  it("lists exactly the packages the SDK reads and writes", () => {
    expect(CONTRACTS.map((c) => c.pkg).sort()).toEqual(Object.values(CASPER_TEST.packages).sort());
  });
});
