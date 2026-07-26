import { blake2b } from "blakejs";
import { createReadClient } from "@/lib/casper/read";
import { readOdraValue, resolveContractHash } from "@/lib/casper/odraRead";

/**
 * Reads customer vaults out of AgentVaults storage.
 *
 * Field indices calibrated live (sdk/scripts/calibrate-vaults.mts): the contract
 * stores `vaults` at mapping index 4 and `count` at 5 — the same +1 offset every
 * other contract here needed. Vault ids are dynamic, so unlike the treasury we
 * hash keys at request time instead of pinning constants.
 */

export const VAULTS_PACKAGE =
  "674cc233514a5e478f84ea37d657cc6b58d41984b788778d6ca554e6615d6914";

const IDX_VAULTS = 4;
const IDX_COUNT = 5;

const u32BE = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, false);
  return b;
};
const u32LE = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n >>> 0, true);
  return b;
};
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

/** Odra: index_bytes = u32 big-endian for indices <= 15. */
const varKey = (idx: number) => hex(blake2b(u32BE(idx), undefined, 32));
const mapKeyU32 = (idx: number, key: number) => {
  const idxBytes = u32BE(idx);
  const keyBytes = u32LE(key);
  const joined = new Uint8Array(idxBytes.length + keyBytes.length);
  joined.set(idxBytes);
  joined.set(keyBytes, idxBytes.length);
  return hex(blake2b(joined, undefined, 32));
};

export interface Vault {
  vaultId: number;
  owner: string;
  agent: string;
  perJob: string;
  perDay: string;
  minTrackRecord: string;
  balance: string;
  frozen: boolean;
}

/** Cursor over the serialized Vault struct. */
class Reader {
  constructor(public b: Uint8Array, public o = 0) {}
  u8() {
    return this.b[this.o++];
  }
  /** Casper address: 1 tag byte + 32. */
  address() {
    const tag = this.u8();
    const h = hex(this.b.slice(this.o, this.o + 32));
    this.o += 32;
    return (tag === 0 ? "account-hash-" : "contract-") + h;
  }
  /** U256: 1 length byte + little-endian magnitude. */
  u256() {
    const n = this.u8();
    let v = BigInt(0);
    for (let i = 0; i < n; i++) v += BigInt(this.b[this.o + i]) * BigInt(256) ** BigInt(i);
    this.o += n;
    return v.toString();
  }
  bool() {
    return this.u8() === 1;
  }
}

function decodeVault(vaultId: number, raw: Uint8Array): Vault {
  const r = new Reader(raw);
  return {
    vaultId,
    owner: r.address(),
    agent: r.address(),
    perJob: r.u256(),
    perDay: r.u256(),
    minTrackRecord: r.u256(),
    balance: r.u256(),
    frozen: r.bool(),
  };
}

/** How many vaults have been opened. */
export async function vaultCount(): Promise<number> {
  const { rpc } = createReadClient();
  const contractHash = await resolveContractHash(rpc, VAULTS_PACKAGE);
  const raw = await readOdraValue(rpc, contractHash, varKey(IDX_COUNT));
  if (!raw || raw.length < 4) return 0;
  return new DataView(raw.buffer, raw.byteOffset, 4).getUint32(0, true);
}

export async function getVault(vaultId: number): Promise<Vault | null> {
  const { rpc } = createReadClient();
  const contractHash = await resolveContractHash(rpc, VAULTS_PACKAGE);
  const raw = await readOdraValue(rpc, contractHash, mapKeyU32(IDX_VAULTS, vaultId));
  return raw ? decodeVault(vaultId, raw) : null;
}

/**
 * Finds the vault belonging to an account hash.
 *
 * The contract keeps an owner→id index, but its keys are hashed addresses, so
 * scanning the (small, sequential) vault list is both simpler and cheaper than
 * reproducing Odra's address encoding off-chain.
 */
export async function vaultOf(accountHashHex: string): Promise<Vault | null> {
  const total = await vaultCount();
  const wanted = accountHashHex.toLowerCase().replace(/^account-hash-/, "");
  for (let id = 0; id < Math.min(total, 64); id++) {
    const v = await getVault(id);
    if (v && v.owner.toLowerCase().endsWith(wanted)) return v;
  }
  return null;
}
