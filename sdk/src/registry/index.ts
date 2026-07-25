/**
 * Registry write-path: register (via proxy_caller_with_return.wasm), token approve,
 * escrow create_job / submit_work / approve, and attestSettlement orchestration.
 *
 * proxy_caller arg names are taken verbatim from odra-core-2.8.1 consts.rs:
 *   PACKAGE_HASH_ARG     = "package_hash"
 *   ENTRY_POINT_ARG      = "entry_point"
 *   ARGS_ARG             = "args"
 *   ATTACHED_VALUE_ARG   = "attached_value"
 *   AMOUNT_ARG           = "amount"
 * (source: odra-casper-rpc-client/src/casper_client/transactions.rs lines 17, 159-164)
 *
 * Live submission (putTransaction) is intentionally absent — deferred to a funded-key run.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { Args, PrivateKey, Transaction } from "casper-js-sdk";
import { sdk } from "../casperSdk.js";
import type { NetworkConfig } from "../config.js";

// ---------------------------------------------------------------------------
// Wasm path: sdk/assets/proxy_caller_with_return.wasm (copied from contracts/)
// ---------------------------------------------------------------------------

function loadProxyCallerWasm(): Uint8Array {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const wasmPath = resolve(__dirname, "../../assets/proxy_caller_with_return.wasm");
  const buf = readFileSync(wasmPath);
  return new Uint8Array(buf);
}

// ---------------------------------------------------------------------------
// Internal non-payable contract call builder (no submission)
// ---------------------------------------------------------------------------

/**
 * Default gas for a small stored-contract call. casper-test assigns a V1 tx to a
 * lane by its serialized size, then requires the PaymentLimited amount to match
 * that lane's gas limit — a small call (≤65_536 bytes, args ≤512) lands in the
 * "wasm lane 5" whose gas_limit is exactly 5 CSPR. Paying less (1.5/2.5 CSPR) is
 * rejected at submission with "Invalid payment amount for Transaction::V1".
 * (Live-verified against the testnet chainspec wasm_lanes config.)
 */
const CALL_GAS_MOTES = 5_000_000_000;

function buildCall(
  cfg: NetworkConfig,
  signer: PrivateKey,
  pkgHash: string,
  entry: string,
  args: Args,
  gasMotes: number = CALL_GAS_MOTES,
): Transaction {
  const tx = new sdk.ContractCallBuilder()
    .from(signer.publicKey)
    .byPackageHash(pkgHash)
    .entryPoint(entry)
    .runtimeArgs(args)
    .chainName(cfg.chainName)
    .payment(gasMotes)
    .build();
  tx.sign(signer);
  return tx;
}

// ---------------------------------------------------------------------------
// register — payable via proxy_caller_with_return.wasm
// ---------------------------------------------------------------------------

/**
 * Builds and signs a register transaction routed through proxy_caller_with_return.wasm.
 *
 * The proxy receives five outer runtime args (names from odra-core-2.8.1/src/consts.rs):
 *   package_hash    — Key::Hash wrapping the identity registry package hash
 *   entry_point     — String "register"
 *   args            — ByteArray of the CL-serialized inner RuntimeArgs (agent_uri: String)
 *   attached_value  — UInt512 bond in motes (actual CSPR attached to the call)
 *   amount          — UInt512 same value (grants main-purse access to the proxy)
 *
 * Does NOT submit. Returns the signed Transaction for offline inspection.
 */
export function buildRegister(
  cfg: NetworkConfig,
  signer: PrivateKey,
  agentUri: string,
  bondMotes: bigint,
  gasMotes = 3_000_000_000,
): Transaction {
  const wasm = loadProxyCallerWasm();

  // CL-serialise the inner args that proxy_caller forwards to identity::register.
  const innerArgs = sdk.Args.fromMap({
    agent_uri: sdk.CLValue.newCLString(agentUri),
  });
  const innerBytes: Uint8Array = innerArgs.toBytes();

  const bond = bondMotes.toString();

  // proxy_caller_with_return arg types are dictated by ProxyCall::load_from_args()
  // (odra-casper/proxy-caller/src/lib.rs @ 2.8.0):
  //   let package_hash       = get_named_arg(PACKAGE_HASH_ARG);   // PackageHash
  //   let entry_point_name   = get_named_arg(ENTRY_POINT_ARG);    // String
  //   let runtime_args: Bytes = get_named_arg(ARGS_ARG);          // Bytes  == List<U8>
  //   let attached_value: U512 = get_named_arg(ATTACHED_VALUE_ARG);
  //
  //   * PackageHash::cl_type() == ByteArray(32)  -> raw 32 hash bytes (NOT a Key).
  //   * Bytes::cl_type()       == List<U8>       -> 4-byte LE length prefix + payload.
  //
  // Live-verified: encoding `args` as ByteArray (no length prefix) OR `package_hash`
  // as a Key both yield ApiError::InvalidArgument on register. The host's typed
  // get_named_arg rejects any CLType mismatch before the entry point runs.
  const pkgBytes = Uint8Array.from(Buffer.from(cfg.packages.identity, "hex"));
  const innerArgsList = sdk.CLValue.newCLList(
    sdk.CLTypeUInt8,
    Array.from(innerBytes, (b) => sdk.CLValue.newCLUint8(b)),
  );

  const tx = new sdk.SessionBuilder()
    .from(signer.publicKey)
    .wasm(wasm)
    .runtimeArgs(
      sdk.Args.fromMap({
        package_hash: sdk.CLValue.newCLByteArray(pkgBytes),
        entry_point: sdk.CLValue.newCLString("register"),
        args: innerArgsList,
        attached_value: sdk.CLValue.newCLUInt512(bond),
        amount: sdk.CLValue.newCLUInt512(bond),
      }),
    )
    .chainName(cfg.chainName)
    .payment(gasMotes)
    .build();

  tx.sign(signer);
  return tx;
}

// ---------------------------------------------------------------------------
// approveToken — CEP-18 approve(spender, amount)
// ---------------------------------------------------------------------------

/**
 * Builds and signs a CEP-18 approve transaction.
 * `spenderPackageHash` is the bare 64-hex package hash of the escrow contract.
 */
export function buildApproveToken(
  cfg: NetworkConfig,
  signer: PrivateKey,
  spenderPackageHash: string,
  amount: bigint,
): Transaction {
  // CEP-18 approve expects `spender` as a Key (package/hash variant).
  const spenderKey = sdk.Key.newKey("hash-" + spenderPackageHash);
  return buildCall(
    cfg,
    signer,
    cfg.packages.cep18,
    "approve",
    sdk.Args.fromMap({
      spender: sdk.CLValue.newCLKey(spenderKey),
      amount: sdk.CLValue.newCLUInt256(amount.toString()),
    }),
  );
}

// ---------------------------------------------------------------------------
// createJob — Escrow create_job(client_id, provider, amount, deadline)
// ---------------------------------------------------------------------------

export interface CreateJobParams {
  clientId: number;
  provider: number;
  amount: bigint;
  deadline: number;
}

export function buildCreateJob(
  cfg: NetworkConfig,
  signer: PrivateKey,
  p: CreateJobParams,
): Transaction {
  return buildCall(
    cfg,
    signer,
    cfg.packages.escrow,
    "create_job",
    sdk.Args.fromMap({
      client_id: sdk.CLValue.newCLUInt32(p.clientId),
      provider: sdk.CLValue.newCLUInt32(p.provider),
      amount: sdk.CLValue.newCLUInt256(p.amount.toString()),
      deadline: sdk.CLValue.newCLUint64(p.deadline),
    }),
  );
}

// ---------------------------------------------------------------------------
// submitWork — Escrow submit_work(job_id, result_hash)
// ---------------------------------------------------------------------------

export function buildSubmitWork(
  cfg: NetworkConfig,
  signer: PrivateKey,
  jobId: bigint,
  resultHash: string,
): Transaction {
  return buildCall(
    cfg,
    signer,
    cfg.packages.escrow,
    "submit_work",
    sdk.Args.fromMap({
      job_id: sdk.CLValue.newCLUint64(jobId.toString()),
      result_hash: sdk.CLValue.newCLString(resultHash),
    }),
  );
}

// ---------------------------------------------------------------------------
// approveJob — Escrow approve(job_id)
// ---------------------------------------------------------------------------

export function buildApproveJob(
  cfg: NetworkConfig,
  signer: PrivateKey,
  jobId: bigint,
): Transaction {
  return buildCall(
    cfg,
    signer,
    cfg.packages.escrow,
    "approve",
    sdk.Args.fromMap({
      job_id: sdk.CLValue.newCLUint64(jobId.toString()),
    }),
  );
}

// ---------------------------------------------------------------------------
// AgentTreasury — the owner's spending envelope
// ---------------------------------------------------------------------------

export interface TreasuryPayParams {
  /** Spend is accounted per task, so the per-task cap applies across calls with the same id. */
  taskId: bigint;
  /** Agent id of the payee — the contract resolves it to a wallet via IdentityRegistry. */
  payee: number;
  amount: bigint;
}

/**
 * `AgentTreasury.pay` — the delegated agent spends from the owner's envelope.
 *
 * The contract, not the caller, decides: the payee must be whitelisted OR clear
 * the reputation threshold, and the amount must fit the per-task cap, the UTC
 * daily cap and the unlocked balance. A rejection reverts on-chain, which is
 * itself the proof that the envelope is enforced.
 *
 * Must be signed by the treasury's `agent` key — any other signer reverts NotAgent.
 */
export function buildTreasuryPay(
  cfg: NetworkConfig,
  signer: PrivateKey,
  p: TreasuryPayParams,
): Transaction {
  return buildCall(
    cfg,
    signer,
    cfg.packages.treasury,
    "pay",
    sdk.Args.fromMap({
      task_id: sdk.CLValue.newCLUint64(p.taskId.toString()),
      payee: sdk.CLValue.newCLUInt32(p.payee),
      amount: sdk.CLValue.newCLUInt256(p.amount.toString()),
    }),
  );
}

/** `AgentTreasury.set_reputation_policy` — admin-only; raises or lowers the counterparty bar. */
export function buildSetReputationPolicy(
  cfg: NetworkConfig,
  signer: PrivateKey,
  minReputation: bigint,
): Transaction {
  return buildCall(
    cfg,
    signer,
    cfg.packages.treasury,
    "set_reputation_policy",
    sdk.Args.fromMap({
      registry: sdk.CLValue.newCLKey(sdk.Key.newKey("hash-" + cfg.packages.reputation)),
      min_reputation: sdk.CLValue.newCLUInt256(minReputation.toString()),
    }),
  );
}

/**
 * `AgentTreasury.pause` / `unpause` — the owner's brake, admin-only.
 *
 * Pausing halts every outflow (payments and new reservations) without moving a
 * token: deposited funds stay put and existing reservations can still be
 * released or refunded. This is what makes delegating spend reversible.
 */
export function buildSetPaused(
  cfg: NetworkConfig,
  signer: PrivateKey,
  paused: boolean,
): Transaction {
  return buildCall(
    cfg,
    signer,
    cfg.packages.treasury,
    paused ? "pause" : "unpause",
    sdk.Args.fromMap({}),
  );
}

/** CEP-18 `transfer` — used to fund the treasury from the deployer's supply. */
export function buildTransferToken(
  cfg: NetworkConfig,
  signer: PrivateKey,
  recipientHash: string,
  amount: bigint,
): Transaction {
  return buildCall(
    cfg,
    signer,
    cfg.packages.cep18,
    "transfer",
    sdk.Args.fromMap({
      recipient: sdk.CLValue.newCLKey(sdk.Key.newKey("hash-" + recipientHash)),
      amount: sdk.CLValue.newCLUInt256(amount.toString()),
    }),
  );
}

// ---------------------------------------------------------------------------
// attestSettlement — offline dry-run plan
// ---------------------------------------------------------------------------

export interface AttestSettlementParams {
  clientSigner: PrivateKey;
  providerSigner: PrivateKey;
  clientId: number;
  providerId: number;
  tokenAmount: bigint;
  deadline: number;
  jobId: bigint;
  resultHash: string;
}

/**
 * Builds the ordered transaction sequence for a full settlement:
 *   1. approveToken  (client approves escrow to spend tokens)
 *   2. createJob     (client locks funds in escrow)
 *   3. submitWork    (provider submits deliverable hash)
 *   4. approveJob    (client approves work, triggers 2% burn + reputation update)
 *
 * Returns the four built+signed Transaction objects in sequence order so the
 * caller can inspect structure offline, then submit in order with waitForTx
 * between each when a funded key is available.
 *
 * Does NOT submit any transaction.
 */
export function buildAttestSettlement(
  cfg: NetworkConfig,
  p: AttestSettlementParams,
): {
  approveTx: Transaction;
  createJobTx: Transaction;
  submitWorkTx: Transaction;
  approveJobTx: Transaction;
} {
  const approveTx = buildApproveToken(
    cfg,
    p.clientSigner,
    cfg.packages.escrow,
    p.tokenAmount,
  );
  const createJobTx = buildCreateJob(cfg, p.clientSigner, {
    clientId: p.clientId,
    provider: p.providerId,
    amount: p.tokenAmount,
    deadline: p.deadline,
  });
  const submitWorkTx = buildSubmitWork(cfg, p.providerSigner, p.jobId, p.resultHash);
  const approveJobTx = buildApproveJob(cfg, p.clientSigner, p.jobId);

  return { approveTx, createJobTx, submitWorkTx, approveJobTx };
}
