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
import {
  ContractCallBuilder,
  SessionBuilder,
  Args,
  CLValue,
  CLTypeUInt8,
  Key,
  type PrivateKey,
  type Transaction,
} from "casper-js-sdk";
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
  const tx = new ContractCallBuilder()
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
  const innerArgs = Args.fromMap({
    agent_uri: CLValue.newCLString(agentUri),
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
  const innerArgsList = CLValue.newCLList(
    CLTypeUInt8,
    Array.from(innerBytes, (b) => CLValue.newCLUint8(b)),
  );

  const tx = new SessionBuilder()
    .from(signer.publicKey)
    .wasm(wasm)
    .runtimeArgs(
      Args.fromMap({
        package_hash: CLValue.newCLByteArray(pkgBytes),
        entry_point: CLValue.newCLString("register"),
        args: innerArgsList,
        attached_value: CLValue.newCLUInt512(bond),
        amount: CLValue.newCLUInt512(bond),
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
  const spenderKey = Key.newKey("hash-" + spenderPackageHash);
  return buildCall(
    cfg,
    signer,
    cfg.packages.cep18,
    "approve",
    Args.fromMap({
      spender: CLValue.newCLKey(spenderKey),
      amount: CLValue.newCLUInt256(amount.toString()),
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
    Args.fromMap({
      client_id: CLValue.newCLUInt32(p.clientId),
      provider: CLValue.newCLUInt32(p.provider),
      amount: CLValue.newCLUInt256(p.amount.toString()),
      deadline: CLValue.newCLUint64(p.deadline),
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
    Args.fromMap({
      job_id: CLValue.newCLUint64(jobId.toString()),
      result_hash: CLValue.newCLString(resultHash),
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
    Args.fromMap({
      job_id: CLValue.newCLUint64(jobId.toString()),
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
