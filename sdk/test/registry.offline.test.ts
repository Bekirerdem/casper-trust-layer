/**
 * Offline registry write-path tests.
 *
 * Each test generates a throwaway key, builds+signs a transaction, and
 * asserts structural correctness WITHOUT any network call.
 *
 * What is NOT verified here (deferred to funded-key live run):
 *   - Gas amounts sufficient for testnet acceptance
 *   - Real tx execution (register succeeds, job settles, score moves)
 *   - proxy_caller_with_return return value deserialization (u32 agent id)
 */

import { describe, it, expect } from "vitest";
import { PrivateKey, KeyAlgorithm } from "casper-js-sdk";
import { CASPER_TEST } from "../src/config.js";
import {
  buildRegister,
  buildApproveToken,
  buildCreateJob,
  buildSubmitWork,
  buildApproveJob,
  buildAttestSettlement,
} from "../src/registry/index.js";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function throwaway(): PrivateKey {
  return PrivateKey.generate(KeyAlgorithm.ED25519);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function argNames(tx: any): string[] {
  return [...(tx.args.args as Map<string, unknown>).keys()];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function argValue(tx: any, name: string): any {
  return (tx.args.args as Map<string, unknown>).get(name);
}

// ---------------------------------------------------------------------------
// register
// ---------------------------------------------------------------------------

describe("buildRegister (offline)", () => {
  const key = throwaway();
  const bondMotes = 10_000_000_000n;
  const tx = buildRegister(CASPER_TEST, key, "ipfs://agent-card", bondMotes);

  it("builds without throwing", () => {
    expect(tx).toBeDefined();
  });

  it("chainName is casper-test", () => {
    expect(tx.chainName).toBe("casper-test");
  });

  it("has at least one approval (signed)", () => {
    // tx.approvals comes from TransactionV1.approvals via the Transaction wrapper
    const inner = (tx as any).transactionV1 ?? (tx as any);
    const approvals = inner?.approvals ?? [];
    expect(approvals.length).toBeGreaterThanOrEqual(1);
  });

  it("targets a Session (wasm bytes present)", () => {
    // TransactionTarget.session should be set for SessionBuilder
    expect(tx.target?.session).toBeDefined();
    expect(tx.target?.session?.moduleBytes?.length).toBeGreaterThan(0);
  });

  it("proxy_caller runtime args contain all five expected keys", () => {
    const names = argNames(tx);
    expect(names).toContain("package_hash");
    expect(names).toContain("entry_point");
    expect(names).toContain("args");
    expect(names).toContain("attached_value");
    expect(names).toContain("amount");
  });

  it("entry_point arg value is 'register'", () => {
    const epArg = argValue(tx, "entry_point");
    expect(epArg?.stringVal?.value).toBe("register");
  });

  it("attached_value equals bondMotes", () => {
    const av = argValue(tx, "attached_value");
    // CLValueUInt512: ui512.value is a BigNumber (ethers-style); convert via .toString()
    expect(av?.ui512).toBeDefined();
    expect(BigInt(av.ui512.value.toString())).toBe(bondMotes);
  });

  it("amount equals bondMotes (same numeric value as attached_value)", () => {
    const amtArg = argValue(tx, "amount");
    expect(amtArg?.ui512).toBeDefined();
    expect(BigInt(amtArg.ui512.value.toString())).toBe(bondMotes);
  });

  it("package_hash arg is a ByteArray(32) of the raw package hash", () => {
    // Live-verified: the proxy reads package_hash as casper_types::PackageHash,
    // whose CLType is ByteArray(32) — a Key (tag 1/16) is rejected as InvalidArgument.
    const pkArg = argValue(tx, "package_hash");
    expect(pkArg?.byteArray).toBeDefined();
    const data: Uint8Array = (pkArg.byteArray as any).data;
    expect(data.length).toBe(32);
  });

  it("args arg is a List<U8> (Bytes) of the inner RuntimeArgs", () => {
    // Live-verified: the proxy reads ARGS_ARG as casper_types::Bytes (CLType List<U8>);
    // a ByteArray (no length prefix) is rejected as InvalidArgument.
    const argsArg = argValue(tx, "args");
    expect(argsArg?.list).toBeDefined();
  });

  it("inner args bytes decode back to contain agent_uri", () => {
    const argsArg = argValue(tx, "args");
    const elements: any[] = (argsArg?.list as any)?.elements ?? [];
    expect(elements.length).toBeGreaterThan(0);
    const rawBytes = Buffer.from(elements.map((e) => Number(e.ui8?.value ?? e.uint8?.value ?? 0)));
    // The UTF-8 text "agent_uri" should appear in the inner serialized RuntimeArgs.
    expect(rawBytes.toString("binary")).toContain("agent_uri");
  });

  it("payment is set (PaymentLimited mode present)", () => {
    expect(tx.pricingMode?.paymentLimited).toBeDefined();
    expect(tx.pricingMode?.paymentLimited?.paymentAmount).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// approveToken
// ---------------------------------------------------------------------------

describe("buildApproveToken (offline)", () => {
  const key = throwaway();
  const tx = buildApproveToken(
    CASPER_TEST,
    key,
    CASPER_TEST.packages.escrow,
    1_000_000n,
  );

  it("builds without throwing", () => {
    expect(tx).toBeDefined();
  });

  it("chainName is casper-test", () => {
    expect(tx.chainName).toBe("casper-test");
  });

  it("entryPoint is Custom:approve", () => {
    expect(tx.entryPoint?.customEntryPoint).toBe("approve");
  });

  it("runtime args contain spender and amount", () => {
    const names = argNames(tx);
    expect(names).toContain("spender");
    expect(names).toContain("amount");
  });

  it("spender is a CLKey", () => {
    const spender = argValue(tx, "spender");
    expect(spender?.key).toBeDefined();
  });

  it("amount is a CLUInt256", () => {
    const amount = argValue(tx, "amount");
    expect(amount?.ui256).toBeDefined();
  });

  it("payment is set", () => {
    expect(tx.pricingMode?.paymentLimited?.paymentAmount).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// createJob
// ---------------------------------------------------------------------------

describe("buildCreateJob (offline)", () => {
  const key = throwaway();
  const params = {
    clientId: 0,
    provider: 1,
    amount: 500_000n,
    deadline: Math.floor(Date.now() / 1000) + 3600,
  };
  const tx = buildCreateJob(CASPER_TEST, key, params);

  it("builds without throwing", () => {
    expect(tx).toBeDefined();
  });

  it("entryPoint is Custom:create_job", () => {
    expect(tx.entryPoint?.customEntryPoint).toBe("create_job");
  });

  it("runtime args contain client_id, provider, amount, deadline", () => {
    const names = argNames(tx);
    expect(names).toContain("client_id");
    expect(names).toContain("provider");
    expect(names).toContain("amount");
    expect(names).toContain("deadline");
  });

  it("client_id is CLUInt32", () => {
    expect(argValue(tx, "client_id")?.ui32).toBeDefined();
  });

  it("provider is CLUInt32", () => {
    expect(argValue(tx, "provider")?.ui32).toBeDefined();
  });

  it("amount is CLUInt256", () => {
    expect(argValue(tx, "amount")?.ui256).toBeDefined();
  });

  it("deadline is CLUInt64", () => {
    expect(argValue(tx, "deadline")?.ui64).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// submitWork
// ---------------------------------------------------------------------------

describe("buildSubmitWork (offline)", () => {
  const key = throwaway();
  const tx = buildSubmitWork(CASPER_TEST, key, 0n, "ipfs://result");

  it("builds without throwing", () => {
    expect(tx).toBeDefined();
  });

  it("entryPoint is Custom:submit_work", () => {
    expect(tx.entryPoint?.customEntryPoint).toBe("submit_work");
  });

  it("runtime args contain job_id and result_hash", () => {
    const names = argNames(tx);
    expect(names).toContain("job_id");
    expect(names).toContain("result_hash");
  });

  it("job_id is CLUInt64", () => {
    expect(argValue(tx, "job_id")?.ui64).toBeDefined();
  });

  it("result_hash is CLString", () => {
    expect(argValue(tx, "result_hash")?.stringVal).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// approveJob
// ---------------------------------------------------------------------------

describe("buildApproveJob (offline)", () => {
  const key = throwaway();
  const tx = buildApproveJob(CASPER_TEST, key, 0n);

  it("builds without throwing", () => {
    expect(tx).toBeDefined();
  });

  it("entryPoint is Custom:approve", () => {
    expect(tx.entryPoint?.customEntryPoint).toBe("approve");
  });

  it("runtime args contain job_id", () => {
    expect(argNames(tx)).toContain("job_id");
  });

  it("job_id is CLUInt64", () => {
    expect(argValue(tx, "job_id")?.ui64).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// attestSettlement (sequence structure)
// ---------------------------------------------------------------------------

describe("buildAttestSettlement (offline)", () => {
  const clientKey = throwaway();
  const providerKey = throwaway();

  const plan = buildAttestSettlement(CASPER_TEST, {
    clientSigner: clientKey,
    providerSigner: providerKey,
    clientId: 0,
    providerId: 1,
    tokenAmount: 500_000n,
    deadline: Math.floor(Date.now() / 1000) + 3600,
    jobId: 0n,
    resultHash: "ipfs://result-hash",
  });

  it("returns four transactions", () => {
    const keys = Object.keys(plan);
    expect(keys).toEqual(["approveTx", "createJobTx", "submitWorkTx", "approveJobTx"]);
  });

  it("approveTx targets CEP-18 approve", () => {
    expect(plan.approveTx.entryPoint?.customEntryPoint).toBe("approve");
  });

  it("createJobTx targets escrow create_job", () => {
    expect(plan.createJobTx.entryPoint?.customEntryPoint).toBe("create_job");
  });

  it("submitWorkTx targets escrow submit_work", () => {
    expect(plan.submitWorkTx.entryPoint?.customEntryPoint).toBe("submit_work");
  });

  it("approveJobTx targets escrow approve", () => {
    expect(plan.approveJobTx.entryPoint?.customEntryPoint).toBe("approve");
  });

  it("all four txs have chainName casper-test", () => {
    for (const tx of Object.values(plan)) {
      expect(tx.chainName).toBe("casper-test");
    }
  });

  it("all four txs are signed (have approvals)", () => {
    for (const tx of Object.values(plan)) {
      const inner = (tx as any).transactionV1 ?? (tx as any);
      const approvals = inner?.approvals ?? [];
      expect(approvals.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("submitWorkTx is signed by the PROVIDER key", () => {
    // approvals[0].signer.toHex() returns the prefixed hex public key used to sign
    const inner = (plan.submitWorkTx as any).transactionV1 ?? (plan.submitWorkTx as any);
    const signer = (inner.approvals ?? [])[0]?.signer;
    expect(signer).toBeDefined();
    expect(signer.toHex()).toBe(providerKey.publicKey.toHex());
  });

  it("approveTx is signed by the CLIENT key", () => {
    const inner = (plan.approveTx as any).transactionV1 ?? (plan.approveTx as any);
    const signer = (inner.approvals ?? [])[0]?.signer;
    expect(signer).toBeDefined();
    expect(signer.toHex()).toBe(clientKey.publicKey.toHex());
  });

  it("createJobTx is signed by the CLIENT key", () => {
    const inner = (plan.createJobTx as any).transactionV1 ?? (plan.createJobTx as any);
    const signer = (inner.approvals ?? [])[0]?.signer;
    expect(signer).toBeDefined();
    expect(signer.toHex()).toBe(clientKey.publicKey.toHex());
  });

  it("approveJobTx is signed by the CLIENT key", () => {
    const inner = (plan.approveJobTx as any).transactionV1 ?? (plan.approveJobTx as any);
    const signer = (inner.approvals ?? [])[0]?.signer;
    expect(signer).toBeDefined();
    expect(signer.toHex()).toBe(clientKey.publicKey.toHex());
  });

  it("submitWorkTx signer differs from CLIENT key (provider != client)", () => {
    // Sanity check: the provider and client keys are different throwaway keys
    const inner = (plan.submitWorkTx as any).transactionV1 ?? (plan.submitWorkTx as any);
    const signer = (inner.approvals ?? [])[0]?.signer;
    expect(signer.toHex()).not.toBe(clientKey.publicKey.toHex());
  });
});
