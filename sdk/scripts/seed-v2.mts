/**
 * Seed the v2 contracts on casper-test with a small, honest demo network.
 *
 * v2 pays no reputation for same-owner settlements, so the v1 trick of one key
 * playing every agent earns nothing. This script uses three owners:
 *
 *   deployer  owns the demo providers #0–#2 (their wallet is the demo signer)
 *   client A  owns #3                     client B  owns #4
 *
 * The demo signer is the low-balance key the web app holds: it is the wallet of
 * the demo providers (accept_job / submit_work), the treasury's delegated agent
 * and the faucet's AGT source. The deployer — admin of every contract — never
 * leaves this machine.
 *
 * Steps (each recorded in ~/.casper-hero/seed-v2.json, so a re-run resumes):
 *   1. fund the demo signer and both clients with CSPR and AGT
 *   2. register #0–#4, point #0–#2 at the demo signer
 *   3. settle the EDGES below through the full v2 escrow flow
 *   4. fund the treasury, prove its three refusals, hand it to the demo signer
 *   5. open a vault and prove its rules the same way
 *
 * Spends real testnet CSPR. Run: npx vite-node scripts/seed-v2.mts
 */
import "dotenv/config";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import {
  Args,
  CLValue,
  ContractCallBuilder,
  Key,
  KeyAlgorithm,
  NativeTransferBuilder,
  PrivateKey,
  PurseIdentifier,
  type Transaction,
} from "casper-js-sdk";
import { CASPER_TEST, type NetworkConfig } from "../src/config.js";
import { makeRpcClient } from "../src/rpc/client.js";
import { resolvePackage } from "../src/rpc/resolve.js";
import { readOdraValue } from "../src/odra/read.js";
import { varKey } from "../src/odra/keys.js";
import { Reader, u32 } from "../src/odra/bytesrepr.js";
import { getAgent, getJob, getJobCount, getReputation } from "../src/trust/index.js";
import {
  buildAcceptJob,
  buildApproveJob,
  buildApproveToken,
  buildCreateJob,
  buildRegister,
  buildSubmitWork,
  buildTreasuryPay,
  buildTransferToken,
  buildSetPaused,
} from "../src/registry/index.js";

// The public node: no token, no daily quota to exhaust halfway through.
const cfg: NetworkConfig = { ...CASPER_TEST, rpcUrl: "https://node.testnet.casper.network/rpc", authToken: undefined };
const rpc = makeRpcClient(cfg);
const c = { rpc, cfg };

const HERO = join(homedir(), ".casper-hero");
const STATE_FILE = join(HERO, "seed-v2.json");

const CSPR = 1_000_000_000n;
const AGT = 1_000_000_000n; // 9 decimals
const CALL_GAS = 5_000_000_000;
const BIG_GAS = 15_000_000_000;
const TRANSFER_GAS = 100_000_000;
const BOND = 10n * CSPR;
const JOB_AMOUNT = 10_000_000n; // 0.01 AGT

// ---------------------------------------------------------------------------
// keys
// ---------------------------------------------------------------------------

function loadKey(path: string): PrivateKey {
  const pem = readFileSync(path, "utf8");
  for (const algo of [KeyAlgorithm.SECP256K1, KeyAlgorithm.ED25519]) {
    try {
      return PrivateKey.fromPem(pem, algo);
    } catch {
      /* try the other curve */
    }
  }
  throw new Error(`cannot parse ${path}`);
}

function loadOrCreateDemoSigner(path: string): PrivateKey {
  if (!existsSync(path)) {
    const key = PrivateKey.generate(KeyAlgorithm.ED25519);
    writeFileSync(path, key.toPem(), { mode: 0o600 });
    console.log(`created demo signer ${key.publicKey.toHex()} at ${path}`);
  }
  return loadKey(path);
}

const deployer = loadKey(process.env.CASPER_SECRET_KEY_PEM!);
// A path here; the web app's DEMO_SIGNER_PEM holds the same key's PEM text.
const demo = loadOrCreateDemoSigner(process.env.DEMO_SIGNER_KEY_PATH ?? join(HERO, "demo_signer_secret.pem"));
const clientA = loadKey(process.env.CLIENT_A_PEM ?? join(HERO, "faucet1_secret.pem"));
const clientB = loadKey(process.env.CLIENT_B_PEM ?? join(HERO, "faucet2_secret.pem"));

const accountKey = (k: PrivateKey) => Key.newKey(k.publicKey.accountHash().toPrefixedString());
const accountHex = (k: PrivateKey) => k.publicKey.accountHash().toHex().replace(/^account-hash-/, "");

// ---------------------------------------------------------------------------
// the network to build
// ---------------------------------------------------------------------------

const AGENTS = [
  { id: 0, owner: deployer, wallet: demo, uri: "ipfs://casper-trust-demo/research-agent" },
  { id: 1, owner: deployer, wallet: demo, uri: "ipfs://casper-trust-demo/translation-agent" },
  { id: 2, owner: deployer, wallet: demo, uri: "ipfs://casper-trust-demo/data-agent" },
  { id: 3, owner: clientA, wallet: clientA, uri: "ipfs://casper-trust-demo/client-a" },
  { id: 4, owner: clientB, wallet: clientB, uri: "ipfs://casper-trust-demo/client-b" },
] as const;
const walletOf = (id: number) => AGENTS[id].wallet;

/** client → provider. Every edge crosses owners, so every one of them can earn. */
const EDGES = [
  { client: 3, provider: 0 },
  { client: 4, provider: 0 },
  { client: 3, provider: 1 },
  { client: 4, provider: 2 },
  { client: 0, provider: 3 },
  { client: 3, provider: 0 },
];

// ---------------------------------------------------------------------------
// state + submission
// ---------------------------------------------------------------------------

type Settlement = { txHash: string; from: number; to: number; amount: string; scoreBefore: number; scoreAfter: number };
type State = {
  done: Record<string, string>;
  probes: Record<string, { hash: string; error?: string }>;
  jobs: Record<string, string>;
  settlements: Settlement[];
};
const state: State = existsSync(STATE_FILE)
  ? JSON.parse(readFileSync(STATE_FILE, "utf8"))
  : { done: {}, probes: {}, jobs: {}, settlements: [] };
const save = () => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

const link = (h: string) => `https://testnet.cspr.live/transaction/${h}`;

async function submit(tx: Transaction): Promise<{ hash: string; error?: string }> {
  const hash = tx.hash.toHex();
  for (let attempt = 1; ; attempt++) {
    try {
      await rpc.putTransaction(tx);
      break;
    } catch (e) {
      if (attempt >= 4) throw e;
      console.log(`  submit retry ${attempt}: ${String((e as Error)?.message ?? e).slice(0, 120)}`);
      await sleep(5_000 * attempt);
    }
  }
  const res: any = await rpc.waitForTransaction(tx, 240_000);
  const exec = res?.executionInfo?.executionResult;
  const error: string | undefined = exec?.errorMessage ?? exec?.v1?.errorMessage;
  await sleep(2_000);
  return { hash, error };
}

/** A step that must succeed; skipped when the state file says it already did. */
async function step(name: string, build: () => Transaction): Promise<string> {
  if (state.done[name]) {
    console.log(`· ${name} (done)`);
    return state.done[name];
  }
  const { hash, error } = await submit(build());
  if (error) throw new Error(`${name} reverted: ${error}  ${link(hash)}`);
  state.done[name] = hash;
  save();
  console.log(`✓ ${name}  ${link(hash)}`);
  return hash;
}

/** A step that must revert with `User error: <code>` — the refusal is the proof. */
async function probe(name: string, code: number, build: () => Transaction) {
  if (state.probes[name]) {
    console.log(`· ${name} (done)`);
    return;
  }
  const { hash, error } = await submit(build());
  const got = error?.match(/User error: (\d+)/)?.[1];
  if (Number(got) !== code) throw new Error(`${name}: expected User error ${code}, got ${error ?? "success"}  ${link(hash)}`);
  state.probes[name] = { hash, error };
  save();
  console.log(`✓ ${name} refused (${code})  ${link(hash)}`);
}

function call(signer: PrivateKey, pkg: string, entry: string, args: Args, gas = CALL_GAS): Transaction {
  const tx = new ContractCallBuilder()
    .from(signer.publicKey)
    .byPackageHash(pkg)
    .entryPoint(entry)
    .runtimeArgs(args)
    .chainName(cfg.chainName)
    .payment(gas)
    .build();
  tx.sign(signer);
  return tx;
}

const u256 = (n: bigint) => CLValue.newCLUInt256(n.toString());
const u32v = (n: number) => CLValue.newCLUInt32(n);

// ---------------------------------------------------------------------------
// reads
// ---------------------------------------------------------------------------

async function csprBalance(k: PrivateKey): Promise<bigint> {
  try {
    const res = await rpc.queryLatestBalance(PurseIdentifier.fromPublicKey(k.publicKey));
    return BigInt(res.balance.toString());
  } catch {
    return 0n; // account does not exist yet
  }
}

async function agentCount(): Promise<number> {
  const { contractHash } = await resolvePackage(rpc, cfg.packages.identity);
  const raw = await readOdraValue(rpc, contractHash, varKey(cfg.fields.identity.count));
  return raw && raw.length >= 4 ? u32(new Reader(raw)) : 0;
}

// ---------------------------------------------------------------------------
// steps
// ---------------------------------------------------------------------------

async function fund() {
  const targets: [string, PrivateKey, bigint][] = [
    ["demo", demo, 400n * CSPR],
    ["clientA", clientA, 150n * CSPR],
    ["clientB", clientB, 100n * CSPR],
  ];
  for (const [name, key, amount] of targets) {
    const have = await csprBalance(key);
    if (state.done[`cspr-${name}`] || have >= amount / 2n) {
      console.log(`· cspr-${name} (${have / CSPR} CSPR)`);
      continue;
    }
    await step(`cspr-${name}`, () => {
      const tx = new NativeTransferBuilder()
        .from(deployer.publicKey)
        .target(key.publicKey)
        .amount(amount.toString())
        .id(Date.now())
        .chainName(cfg.chainName)
        .payment(TRANSFER_GAS)
        .build();
      tx.sign(deployer);
      return tx;
    });
  }

  const tokens: [string, PrivateKey, bigint][] = [
    ["demo", demo, 10n * AGT], // faucet stock: 1,000 claims of 0.01
    ["clientA", clientA, 1n * AGT],
    ["clientB", clientB, 1n * AGT],
  ];
  for (const [name, key, amount] of tokens) {
    await step(`agt-${name}`, () =>
      call(deployer, cfg.packages.cep18, "transfer", Args.fromMap({ recipient: CLValue.newCLKey(accountKey(key)), amount: u256(amount) })),
    );
  }
}

async function registerAgents() {
  for (const a of AGENTS) {
    const count = await agentCount();
    if (count > a.id) {
      console.log(`· register #${a.id} (done)`);
    } else {
      if (count !== a.id) throw new Error(`registry has ${count} agents, expected ${a.id} before registering #${a.id}`);
      await step(`register-${a.id}`, () => buildRegister(cfg, a.owner, a.uri, BOND));
      if ((await agentCount()) !== a.id + 1) throw new Error(`#${a.id} did not land at its expected id`);
    }

    const agent = await getAgent(c, a.id);
    if (!agent?.owner.endsWith(accountHex(a.owner))) throw new Error(`#${a.id} has an unexpected owner`);
    if (!agent.wallet.endsWith(accountHex(a.wallet))) {
      await step(`wallet-${a.id}`, () =>
        call(a.owner, cfg.packages.identity, "set_agent_wallet", Args.fromMap({ agent_id: u32v(a.id), wallet: CLValue.newCLKey(accountKey(a.wallet)) })),
      );
    }
  }
}

async function settle() {
  for (const [i, e] of EDGES.entries()) {
    const name = `job-${i}`;
    const client = walletOf(e.client);
    const provider = walletOf(e.provider);

    if (state.jobs[name] === undefined) {
      await step(`${name}-approve`, () => buildApproveToken(cfg, client, cfg.packages.escrow, JOB_AMOUNT));
      state.jobs[name] = (await getJobCount(c)).toString();
      save();
      await step(`${name}-create`, () =>
        buildCreateJob(cfg, client, {
          clientId: e.client,
          provider: e.provider,
          amount: JOB_AMOUNT,
          deadline: Date.now() + 2 * 60 * 60 * 1000,
        }),
      );
    }

    const jobId = BigInt(state.jobs[name]);
    const job = await getJob(c, jobId);
    if (!job || job.clientId !== e.client || job.provider !== e.provider) {
      throw new Error(`${name}: job #${jobId} is not ${e.client}→${e.provider}`);
    }

    if (job.state === "Funded") await step(`${name}-accept`, () => buildAcceptJob(cfg, provider, jobId));
    if (job.state === "Funded" || job.state === "Accepted") {
      await step(`${name}-submit`, () => buildSubmitWork(cfg, provider, jobId, `sha256:seed-v2-job-${jobId}`));
    }
    if (job.state !== "Released") {
      const before = await getReputation(c, e.provider);
      const hash = await step(`${name}-release`, () => buildApproveJob(cfg, client, jobId));
      const after = await getReputation(c, e.provider);
      state.settlements.push({
        txHash: hash,
        from: e.client,
        to: e.provider,
        amount: JOB_AMOUNT.toString(),
        scoreBefore: Number(before.scoreBps),
        scoreAfter: Number(after.scoreBps),
      });
      save();
      console.log(`  #${e.provider}: ${before.scoreBps} → ${after.scoreBps} bps`);
    }
  }
}

async function treasury() {
  const t = cfg.packages.treasury;
  await step("treasury-fund", () => buildTransferToken(cfg, deployer, t, 1_000n * AGT));
  // The deployer is still the delegated agent here, so it can prove the envelope.
  await step("treasury-pay-proven", () => buildTreasuryPay(cfg, deployer, { taskId: 1n, payee: 0, amount: AGT }));
  await probe("treasury-pay-unproven", 5, () => buildTreasuryPay(cfg, deployer, { taskId: 2n, payee: 4, amount: AGT }));
  await probe("treasury-pay-over-limit", 6, () => buildTreasuryPay(cfg, deployer, { taskId: 3n, payee: 0, amount: 150n * AGT }));
  await step("treasury-pause", () => buildSetPaused(cfg, deployer, true));
  await probe("treasury-pay-paused", 12, () => buildTreasuryPay(cfg, deployer, { taskId: 4n, payee: 0, amount: AGT }));
  await step("treasury-unpause", () => buildSetPaused(cfg, deployer, false));
  await step("treasury-set-agent", () => call(deployer, t, "set_agent", Args.fromMap({ agent: CLValue.newCLKey(accountKey(demo)) })));
}

async function vault() {
  const v = cfg.packages.vaults;
  const pay = (task: string, payee: number) =>
    call(deployer, v, "pay", Args.fromMap({ vault_id: u32v(0), task_id: CLValue.newCLUint64(task), payee: u32v(payee), amount: u256(AGT) }), BIG_GAS);

  await step("vault-open", () =>
    call(
      deployer,
      v,
      "open_vault",
      Args.fromMap({ agent: CLValue.newCLKey(accountKey(deployer)), per_job: u256(100n * AGT), per_day: u256(500n * AGT), min_track_record: u256(1n) }),
      BIG_GAS,
    ),
  );
  await step("vault-approve", () =>
    call(deployer, cfg.packages.cep18, "approve", Args.fromMap({ spender: CLValue.newCLKey(Key.newKey("hash-" + v)), amount: u256(50n * AGT) })),
  );
  await step("vault-deposit", () => call(deployer, v, "deposit", Args.fromMap({ vault_id: u32v(0), amount: u256(50n * AGT) }), BIG_GAS));
  await step("vault-pay-proven", () => pay("1", 0));
  await probe("vault-pay-unproven", 5, () => pay("2", 4));
  await step("vault-freeze", () => call(deployer, v, "freeze", Args.fromMap({ vault_id: u32v(0) })));
  await probe("vault-pay-frozen", 9, () => pay("3", 0));
  await step("vault-unfreeze", () => call(deployer, v, "unfreeze", Args.fromMap({ vault_id: u32v(0) })));
}

async function main() {
  console.log(`deployer ${deployer.publicKey.toHex()}  ${(await csprBalance(deployer)) / CSPR} CSPR`);
  console.log(`demo     ${demo.publicKey.toHex()}`);
  console.log(`client A ${clientA.publicKey.toHex()}`);
  console.log(`client B ${clientB.publicKey.toHex()}\n`);

  const only = process.env.ONLY?.split(",");
  const run = (n: string) => !only || only.includes(n);
  if (run("fund")) await fund();
  if (run("agents")) await registerAgents();
  if (run("jobs")) await settle();
  if (run("treasury")) await treasury();
  if (run("vault")) await vault();

  console.log(`\ndeployer left with ${(await csprBalance(deployer)) / CSPR} CSPR`);
  console.log(`state: ${STATE_FILE}`);
}

main().catch((e) => {
  console.error(String(e?.stack ?? e));
  process.exitCode = 1;
});
