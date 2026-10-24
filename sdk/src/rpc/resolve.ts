import type { RpcClient } from "casper-js-sdk";

type Resolved = { contractHash: string; stateUref: string };

// A package only gets a new contract hash when a new version is installed, so a
// short cache spares two global-state queries on every read without going stale.
const CACHE_MS = 10 * 60_000;
const cache = new WeakMap<RpcClient, Map<string, { at: number; value: Resolved }>>();

/**
 * Resolves a ContractPackage hash to its active contract hash + the "state" URef.
 * The "state" URef is the Odra dictionary seed for reading stored fields.
 */
export async function resolvePackage(rpc: RpcClient, packageHashHex: string): Promise<Resolved> {
  let perRpc = cache.get(rpc);
  if (!perRpc) {
    perRpc = new Map();
    cache.set(rpc, perRpc);
  }
  const hit = perRpc.get(packageHashHex);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const pkg = await rpc.queryLatestGlobalState(`hash-${packageHashHex}`, []);

  // StoredValue.contractPackage — lowercase 'c' in casper-js-sdk v5
  const versions = pkg.storedValue.contractPackage?.versions;
  if (!versions || versions.length === 0) {
    throw new Error(`No versions found in package ${packageHashHex}`);
  }

  // contractHash is a ContractHash object — use .hash.toHex() for raw 64-char hex
  const latestVersion = versions[versions.length - 1];
  const contractHash: string = latestVersion.contractHash.hash.toHex();

  const contractResult = await rpc.queryLatestGlobalState(`hash-${contractHash}`, []);

  // StoredValue.contract.namedKeys is NamedKey[] — NamedKey.key is a Key object
  const namedKeys = contractResult.storedValue.contract?.namedKeys;
  if (!namedKeys) {
    throw new Error(`No namedKeys on contract ${contractHash}`);
  }

  const stateEntry = namedKeys.find((k) => k.name === "state");
  if (!stateEntry) {
    throw new Error(`No 'state' named key on contract ${contractHash}`);
  }

  // Key.toPrefixedString() returns "uref-<hex>-<access>" format
  const value = { contractHash, stateUref: stateEntry.key.toPrefixedString() };
  perRpc.set(packageHashHex, { at: Date.now(), value });
  return value;
}
