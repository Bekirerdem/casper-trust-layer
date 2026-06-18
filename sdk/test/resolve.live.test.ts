/**
 * Live calibration test for Task 3.
 *
 * Scans Var indices 0..6 on all three deployed contracts (reputation, identity, escrow)
 * to find which index stores each KNOWN sibling package hash wired at deploy time.
 * This pins the live field indices empirically — independent of source declaration order.
 *
 * Run with: CASPER_LIVE=1 npx vitest run test/resolve.live.test.ts
 */
import { describe, it, expect } from "vitest";
import { CASPER_TEST } from "../src/config.js";
import { makeRpcClient } from "../src/rpc/client.js";
import { resolvePackage } from "../src/rpc/resolve.js";
import { readOdraValue } from "../src/odra/read.js";
import { varKey } from "../src/odra/keys.js";
import { Reader, addr } from "../src/odra/bytesrepr.js";

const live = process.env.CASPER_LIVE === "1";

/** Scan indices 0..maxIdx, decode each as an Address Var, return index → contract hex map. */
async function scanVarAddresses(
  rpc: ReturnType<typeof makeRpcClient>,
  contractHash: string,
  maxIdx = 6,
): Promise<Record<number, string>> {
  const found: Record<number, string> = {};
  for (let i = 0; i <= maxIdx; i++) {
    const p = await readOdraValue(rpc, contractHash, varKey(i));
    if (p && p.length >= 33) {
      try {
        const decoded = addr(new Reader(p)).replace(/^contract-/, "");
        found[i] = decoded;
      } catch {
        // not an Address — skip
      }
    }
  }
  return found;
}

describe.skipIf(!live)("live resolution + field-index calibration", () => {
  it("resolves the reputation package to a contract + state URef", async () => {
    const rpc = makeRpcClient(CASPER_TEST);
    const { contractHash, stateUref } = await resolvePackage(
      rpc,
      CASPER_TEST.packages.reputation,
    );
    expect(contractHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stateUref).toMatch(/^uref-/);
    console.log("reputation contractHash:", contractHash);
    console.log("reputation stateUref:", stateUref);
  }, 30_000);

  it(
    "calibrates ReputationEngine field indices (escrow + identity Address Vars)",
    async () => {
      const rpc = makeRpcClient(CASPER_TEST);
      const { contractHash } = await resolvePackage(
        rpc,
        CASPER_TEST.packages.reputation,
      );
      const found = await scanVarAddresses(rpc, contractHash);

      console.log("ReputationEngine Var indices (index → contract hex):", found);

      // ReputationEngine source: admin(0), escrow(1), identity(2), reps(3 Mapping), pairs(4 Mapping)
      const values = Object.values(found);
      expect(values).toContain(CASPER_TEST.packages.escrow);
      expect(values).toContain(CASPER_TEST.packages.identity);

      const escrowIdx = Number(
        Object.entries(found).find(([, v]) => v === CASPER_TEST.packages.escrow)![0],
      );
      const identityIdx = Number(
        Object.entries(found).find(([, v]) => v === CASPER_TEST.packages.identity)![0],
      );
      const sourceEscrow = 1; // source declaration position
      const sourceIdentity = 2;
      const offset = escrowIdx - sourceEscrow;
      console.log(
        `ReputationEngine: escrow at live idx=${escrowIdx} (source=1, offset=${offset}), ` +
          `identity at live idx=${identityIdx} (source=2, offset=${offset === identityIdx - sourceIdentity ? offset : "DIFFERS"})`,
      );
      console.log(
        `Calibrated: reps Mapping live index = ${3 + offset}, pairs Mapping live index = ${4 + offset}`,
      );
    },
    60_000,
  );

  it(
    "calibrates IdentityRegistry field indices (escrow Address Var)",
    async () => {
      const rpc = makeRpcClient(CASPER_TEST);
      const { contractHash } = await resolvePackage(
        rpc,
        CASPER_TEST.packages.identity,
      );
      const found = await scanVarAddresses(rpc, contractHash);

      console.log("IdentityRegistry Var indices (index → contract hex):", found);

      // IdentityRegistry source: admin(0), escrow(1), agents(2 Mapping), count(3)
      const values = Object.values(found);
      expect(values).toContain(CASPER_TEST.packages.escrow);

      const escrowIdx = Number(
        Object.entries(found).find(([, v]) => v === CASPER_TEST.packages.escrow)![0],
      );
      const sourceEscrow = 1;
      const offset = escrowIdx - sourceEscrow;
      console.log(
        `IdentityRegistry: escrow at live idx=${escrowIdx} (source=1, offset=${offset})`,
      );
      console.log(
        `Calibrated: agents Mapping live index = ${2 + offset}, count Var live index = ${3 + offset}`,
      );
    },
    60_000,
  );

  it(
    "calibrates Escrow field indices (identity + reputation + token Address Vars)",
    async () => {
      const rpc = makeRpcClient(CASPER_TEST);
      const { contractHash } = await resolvePackage(
        rpc,
        CASPER_TEST.packages.escrow,
      );
      const found = await scanVarAddresses(rpc, contractHash);

      console.log("Escrow Var indices (index → contract hex):", found);

      // Escrow source: identity(0), reputation(1), token(2), jobs(3 Mapping), count(4)
      const values = Object.values(found);
      expect(values).toContain(CASPER_TEST.packages.identity);
      expect(values).toContain(CASPER_TEST.packages.reputation);
      expect(values).toContain(CASPER_TEST.packages.cep18);

      const identityIdx = Number(
        Object.entries(found).find(([, v]) => v === CASPER_TEST.packages.identity)![0],
      );
      const reputationIdx = Number(
        Object.entries(found).find(([, v]) => v === CASPER_TEST.packages.reputation)![0],
      );
      const tokenIdx = Number(
        Object.entries(found).find(([, v]) => v === CASPER_TEST.packages.cep18)![0],
      );
      const sourceIdentity = 0;
      const offset = identityIdx - sourceIdentity;
      console.log(
        `Escrow: identity at live idx=${identityIdx} (source=0, offset=${offset}), ` +
          `reputation at live idx=${reputationIdx} (source=1), ` +
          `token at live idx=${tokenIdx} (source=2)`,
      );
      console.log(
        `Calibrated: jobs Mapping live index = ${3 + offset}, count Var live index = ${4 + offset}`,
      );
    },
    60_000,
  );

  // Regression assertion — uses the calibrated escrowVarIndex from config
  it(
    "escrow Var is at the calibrated index (regression)",
    async () => {
      const rpc = makeRpcClient(CASPER_TEST);
      const { contractHash } = await resolvePackage(
        rpc,
        CASPER_TEST.packages.reputation,
      );
      const escrowVarIndex = CASPER_TEST.fields.reputation.escrowVarIndex;
      const p = await readOdraValue(rpc, contractHash, varKey(escrowVarIndex));
      expect(p).not.toBeNull();
      const decoded = addr(new Reader(p!)).replace(/^contract-/, "");
      expect(decoded).toBe(CASPER_TEST.packages.escrow);
    },
    30_000,
  );
});
