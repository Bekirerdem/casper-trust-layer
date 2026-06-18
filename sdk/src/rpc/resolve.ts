import type { RpcClient } from "casper-js-sdk";

/**
 * Resolves a ContractPackage hash to its active contract hash + the "state" URef.
 * The "state" URef is the Odra dictionary seed for reading stored fields.
 */
export async function resolvePackage(
  rpc: RpcClient,
  packageHashHex: string,
): Promise<{ contractHash: string; stateUref: string }> {
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
  return { contractHash, stateUref: stateEntry.key.toPrefixedString() };
}
