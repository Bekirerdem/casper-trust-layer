import { describe, it, expect } from "vitest";
import * as api from "../src/index.js";

describe("public surface", () => {
  it("exports the documented one-line API", () => {
    for (const name of [
      "createTrustClient",
      "checkTrust",
      "getReputation",
      "pay",
      "register",
      "attestSettlement",
    ]) {
      expect(typeof (api as any)[name]).toBe("function");
    }
  });
});
